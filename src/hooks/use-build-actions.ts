import { useCallback, useEffect, useRef, type Dispatch } from "react"
import type { JenkinsClient, QueueItem } from "../api/jenkins"
import { getActiveProfileName } from "../config"
import type { AppAction, AppState, ParamsState } from "../state/store"
import type { BuildParamValue, Deployment, Organization, ParamField, Project } from "../types"

const QUEUE_POLL_ATTEMPTS = 30
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err))

type Dependencies = {
  api: JenkinsClient
  dispatch: Dispatch<AppAction>
  activeProfile: string
  stateRef: { current: AppState }
  organizationsRef: { current: Organization[] }
  projectPathRef: { current: string | undefined }
  notify: (text: string, tone?: "info" | "error") => void
  refresh: (jobPath: string) => Promise<Deployment[]>
  latestBuild: (jobPath: string) => number | undefined
  reloadOrganizations: (options?: { silent?: boolean }) => void
  reloadQueue: () => void
}

/**
 * Write-side actions: build (with parameters), abort, queue cancel, and the
 * queue-following poll that turns a queue URL into a build number.
 */
export function useBuildActions({
  api,
  dispatch,
  activeProfile,
  stateRef,
  organizationsRef,
  projectPathRef,
  notify,
  refresh,
  latestBuild,
  reloadOrganizations,
  reloadQueue,
}: Dependencies) {
  const followToken = useRef(0)
  const running = useRef(false)
  const loadingParams = useRef(false)

  // Stop a queue poll from touching state after the app is gone.
  useEffect(() => {
    return () => {
      followToken.current += 1
    }
  }, [])

  const confirmBuild = useCallback(
    (path: string, name: string, values: BuildParamValue[]) => {
      dispatch({
        type: "askConfirm",
        action: {
          kind: "build",
          label: `Start a new build of ${name}?`,
          profile: activeProfile,
          url: api.jobUrl(path),
          projectPath: path,
          params: values.length > 0 ? values : undefined,
        },
      })
    },
    [activeProfile, api, dispatch],
  )

  // Parameterized jobs need a form; otherwise go straight to confirmation.
  const askBuild = useCallback(
    (project: Project | undefined, params: ParamsState | null) => {
      if (params) {
        const invalid = params.fields.find(
          (field) =>
            (field.choices && field.choices.length > 0 && !field.choices.includes(field.value)) ||
            (field.type.includes("Boolean") && field.value !== "true" && field.value !== "false"),
        )
        if (invalid) {
          notify(`Invalid value for ${invalid.name}: ${invalid.value || "(empty)"}`, "error")
          return
        }
        const values = params.fields.map((field) => ({
    name: field.name,
    value: field.value,
    secret: field.type.includes("Password"),
  }))
        dispatch({ type: "closeParams" })
        confirmBuild(params.projectPath, params.projectName, values)
        return
      }
      if (!project) return
      if (loadingParams.current) return
      loadingParams.current = true
      const target = project
      const profile = activeProfile
      void api
        .fetchBuildParameters(target.path)
        .then((definitions) => {
          if (getActiveProfileName() !== profile || projectPathRef.current !== target.path) return
          if (definitions.length === 0) {
            confirmBuild(target.path, target.name, [])
            return
          }
          const fields: ParamField[] = definitions.map((definition) => ({
            ...definition,
            value: definition.defaultValue,
          }))
          dispatch({ type: "openParams", projectPath: target.path, projectName: target.name, fields })
        })
        .catch((err) => {
          if (getActiveProfileName() !== profile || projectPathRef.current !== target.path) return
          notify(`Could not load parameters; build cancelled: ${errorMessage(err)}`, "error")
        })
        .finally(() => {
          loadingParams.current = false
        })
    },
    [activeProfile, api, confirmBuild, dispatch, notify, projectPathRef],
  )

  const askStop = useCallback(
    (project: Project | undefined, deployment: Deployment | undefined, running: boolean) => {
      if (!project || !deployment) return
      if (!running) {
        notify("Build is not running", "info")
        return
      }
      dispatch({
        type: "askConfirm",
        action: {
          kind: "stop",
          label: `Abort ${project.name} ${deployment.name}?`,
          profile: activeProfile,
          url: api.buildConsoleUrl(project.path, deployment.number),
          projectPath: project.path,
          buildNumber: deployment.number,
        },
      })
    },
    [activeProfile, api, dispatch, notify],
  )

  const askCancelQueue = useCallback(
    (item: QueueItem | undefined) => {
      if (!item) return
      dispatch({
        type: "askConfirm",
        action: {
          kind: "cancelQueue",
          label: `Cancel queued build ${item.name}?`,
          profile: activeProfile,
          url: api.profile.url,
          queueId: item.id,
        },
      })
    },
    [activeProfile, api, dispatch],
  )

  const followQueue = useCallback(
    async (queueUrl: string | undefined, jobPath: string, baseline: number | undefined) => {
      const token = ++followToken.current
      // Old Jenkins versions occasionally omit Location. Fall back to a short
      // wait instead of polling a URL we do not have.
      if (!queueUrl) {
        await sleep(2500)
        if (token !== followToken.current) return
        void refresh(jobPath).catch(() => {})
        return
      }
      for (let attempt = 0; attempt < QUEUE_POLL_ATTEMPTS; attempt++) {
        await sleep(1000)
        if (token !== followToken.current) return
        let number = await api.fetchQueuedBuildNumber(queueUrl)
        let refreshed: Deployment[] | null = null
        // Once a build leaves the queue, its item can 404 before we read the
        // build number. Ask the job for a build newer than the one we started.
        if (number === undefined && baseline !== undefined && (attempt + 1) % 3 === 0) {
          const builds = await refresh(jobPath).catch(() => [] as Deployment[])
          const newer = builds.find((build) => build.number > baseline)
          if (newer) {
            number = newer.number
            refreshed = builds
          }
        }
        if (number === undefined) continue
        if (!refreshed) await refresh(jobPath).catch(() => {})
        if (token !== followToken.current) return
        notify(`Build #${number} started`, "info")
        const current = stateRef.current
        const idle =
          current.mode === "list" &&
          !current.helpOpen &&
          !current.profileOpen &&
          !current.queueOpen &&
          !current.confirm &&
          !current.params
        if (idle && projectPathRef.current === jobPath) {
          const owner = organizationsRef.current.find((entry) =>
            entry.projects.some((candidate) => candidate.path === jobPath),
          )
          if (owner) {
            dispatch({ type: "openBuild", org: owner.name, projectPath: jobPath, buildNumber: number })
          }
        }
        return
      }
      if (token === followToken.current) notify("Build is still queued or did not start", "info")
    },
    [api, dispatch, notify, organizationsRef, projectPathRef, refresh, stateRef],
  )

  const runConfirmed = useCallback(async () => {
    const action = stateRef.current.confirm
    if (!action || stateRef.current.busy || running.current) return
    running.current = true
    dispatch({ type: "clearConfirm" })
    dispatch({ type: "setBusy", busy: true })
    try {
      if (action.kind === "build") {
        dispatch({ type: "closeParams" })
        notify("Triggering build…", "info")
        const baseline = latestBuild(action.projectPath)
        const queueUrl = await api.triggerBuild(action.projectPath, action.params ?? [])
        if (getActiveProfileName() !== action.profile) return
        notify("Build queued — waiting for it to start…", "info")
        void followQueue(queueUrl, action.projectPath, baseline)
      } else if (action.kind === "stop") {
        notify("Aborting build…", "info")
        await api.stopBuild(action.projectPath, action.buildNumber)
        if (getActiveProfileName() !== action.profile) return
        notify("Abort requested", "info")
        const profile = action.profile
        setTimeout(() => {
          if (getActiveProfileName() !== profile) return
          void refresh(action.projectPath).catch(() => {})
          reloadOrganizations({ silent: true })
        }, 1500)
      } else {
        notify("Cancelling queued build…", "info")
        await api.cancelQueueItem(action.queueId)
        if (getActiveProfileName() !== action.profile) return
        notify("Queued build cancelled", "info")
        reloadQueue()
      }
    } catch (err) {
      notify(errorMessage(err), "error")
    } finally {
      running.current = false
      dispatch({ type: "setBusy", busy: false })
    }
  }, [api, dispatch, followQueue, latestBuild, notify, refresh, reloadOrganizations, reloadQueue, stateRef])

  const openQueueItem = useCallback(
    (item: QueueItem | undefined) => {
      if (!item) return
      if (!item.buildNumber || !item.path) {
        notify("Build is still queued", "info")
        return
      }
      const owner = organizationsRef.current.find((entry) =>
        entry.projects.some((candidate) => candidate.path === item.path),
      )
      if (!owner) {
        notify("Build is not part of a configured view", "error")
        return
      }
      dispatch({ type: "openBuild", org: owner.name, projectPath: item.path, buildNumber: item.buildNumber })
    },
    [dispatch, notify, organizationsRef],
  )

  const cancelFollow = useCallback(() => {
    followToken.current += 1
  }, [])

  return { askBuild, askStop, askCancelQueue, runConfirmed, openQueueItem, cancelFollow }
}
