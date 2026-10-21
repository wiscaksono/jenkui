import { useKeyboard, useRenderer } from "@opentui/react"
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"
import { Header } from "./components/header"
import { HelpDialog } from "./components/help-dialog"
import { NoticeBar } from "./components/notice-bar"
import { ParamsDialog } from "./components/params-dialog"
import { Placeholder } from "./components/placeholder"
import { ProfileDialog } from "./components/profile-dialog"
import { ConfirmDialog } from "./components/confirm-dialog"
import { QueueDialog } from "./components/queue-dialog"
import { SearchBar } from "./components/search-bar"
import { useOrganizations } from "./hooks/use-organizations"
import { useSelection } from "./hooks/use-selection"
import { useDeployments } from "./hooks/use-deployments"
import { useRunStream } from "./hooks/use-run-stream"
import { useQueue } from "./hooks/use-queue"
import { useBuildActions } from "./hooks/use-build-actions"
import { createJenkinsClient } from "./api/jenkins"
import { copyToClipboard, openInBrowser } from "./utils/host"
import { DeployScreen } from "./screens/deploy-screen"
import { OrgScreen } from "./screens/org-screen"
import { ProjectScreen } from "./screens/project-screen"
import { RunScreen } from "./screens/run-screen"
import { initialState, reducer, type AppState } from "./state/store"
import { keyToAction } from "./state/keymap"
import { config, getActiveProfile, getActiveProfileName, profileNames, setActiveProfile } from "./config"
import type { Deployment } from "./types"
import { VIEW_META, breadcrumbFor } from "./state/views"
import { resolveSelection } from "./hooks/resolve-selection"

const NO_DEPLOYMENTS: Record<string, Deployment[]> = {}

const clamp = (index: number, length: number) => Math.max(0, Math.min(index, length - 1))

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const renderer = useRenderer()
  const {
    view,
    mode,
    queries,
    helpOpen,
    profileOpen,
    profileIndex,
    confirm,
    busy,
    statusFilter,
    autoRefresh,
    queueOpen,
    queueIndex,
    params,
    notice,
  } = state
  const searching = mode === "search"
  const query = queries[view] ?? ""

  const [activeProfile, setActiveProfileState] = useState(getActiveProfileName())
  const profiles = profileNames()
  // One client per profile. It owns the commit-count cache, so switching
  // profiles cannot leak build data between servers.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- activeProfile is the profile-switch trigger
  const api = useMemo(() => createJenkinsClient(getActiveProfile()), [activeProfile])
  const [reloadToken, setReloadToken] = useState(0)

  const { organizations, loading, error, reload: reloadOrganizations } = useOrganizations(api, activeProfile)

  // Resolve the project before builds: the build-history hook needs the job
  // path, while the full selection needs the build map it returns.
  const projectPath = useMemo(
    () => resolveSelection(state, organizations, NO_DEPLOYMENTS).project?.path,
    [state, organizations],
  )

  const { deploymentsByJob, refresh, isLoadingMore } = useDeployments(
    api,
    view,
    projectPath,
    state.selectedDeployment,
    reloadToken,
  )

  const {
    orgList,
    org,
    orgIndex,
    projectList,
    project,
    projectIndex,
    deployList,
    deployment,
    deploymentIndex,
  } = useSelection(state, organizations, deploymentsByJob)

  const queue = useQueue(api, queueOpen)
  const queueIndexClamped = Math.min(queueIndex, Math.max(queue.items.length - 1, 0))

  const onBuildFinished = useCallback(() => {
    if (projectPath) void refresh(projectPath).catch(() => {})
  }, [projectPath, refresh])

  const run = useRunStream(
    api,
    view === "run" ? projectPath : undefined,
    view === "run" ? deployment?.number : undefined,
    reloadToken,
    onBuildFinished,
  )

  // Async callbacks read these refs so a long queue poll never acts on a stale
  // selection, organization tree, or profile.
  const stateRef = useRef(state)
  stateRef.current = state
  const organizationsRef = useRef(organizations)
  organizationsRef.current = organizations
  const projectPathRef = useRef(projectPath)
  projectPathRef.current = projectPath
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const notify = useCallback((text: string, tone: "info" | "error" = "info") => {
    dispatch({ type: "setNotice", notice: { text, tone } })
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => dispatch({ type: "setNotice", notice: null }), 5000)
  }, [])

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current)
    }
  }, [])

  // A failed background refresh should be visible even when the cached list is
  // still on screen; the placeholder only reports errors when the list is empty.
  useEffect(() => {
    if (error && organizations.length > 0) notify(error, "error")
  }, [error, organizations.length, notify])

  const buildActions = useBuildActions({
    api,
    dispatch,
    activeProfile,
    stateRef,
    organizationsRef,
    projectPathRef,
    notify,
    refresh,
    latestBuild: (jobPath) => deploymentsByJob[jobPath]?.[0]?.number,
    reloadOrganizations,
    reloadQueue: queue.reload,
  })

  const refreshAll = useCallback(() => {
    setReloadToken((value) => value + 1)
    reloadOrganizations()
  }, [reloadOrganizations])

  const drillIn = useCallback(() => {
    if (view === "org" && org) dispatch({ type: "selectOrg", name: org.name })
    else if (view === "project" && project) dispatch({ type: "selectProject", path: project.path })
    else if (view === "deploy" && deployment) dispatch({ type: "selectDeployment", number: deployment.number })
    dispatch({ type: "drillIn" })
  }, [view, org, project, deployment])

  function switchProfile(name: string) {
    if (name === activeProfile) {
      dispatch({ type: "closeProfiles" })
      return
    }
    console.debug(`[profile] switch ${activeProfile} -> ${name}`)
    buildActions.cancelFollow()
    setActiveProfile(name)
    setActiveProfileState(name)
    dispatch({ type: "resetForProfile" })
    dispatch({ type: "closeProfiles" })
  }

  function openConsole() {
    if (project && deployment) {
      openInBrowser(api.buildConsoleUrl(project.path, deployment.number))
      return
    }
    if (project) openInBrowser(api.jobUrl(project.path))
  }

  function copyLink() {
    const url =
      project && deployment
        ? api.buildConsoleUrl(project.path, deployment.number)
        : project
          ? api.jobUrl(project.path)
          : undefined
    if (!url) return
    const ok = copyToClipboard(renderer, url)
    console.debug(`[clip] ${ok ? "copied" : "failed"}: ${url}`)
  }

  // Auto-refresh is for the lists. While the run view is open the console poll
  // already keeps the build fresh; refetching the whole tree would only add load.
  useEffect(() => {
    if (!autoRefresh) return
    if (confirm || helpOpen || profileOpen || queueOpen || searching || params) return
    const timer = setInterval(() => {
      if (view !== "run") reloadOrganizations({ silent: true })
      // Refreshing while a page is loading invalidates that page's generation,
      // so slow pagination would never finish.
      if (view === "deploy" && projectPath && !isLoadingMore(projectPath)) {
        void refresh(projectPath).catch(() => {})
      }
    }, config.autoRefreshMs)
    return () => clearInterval(timer)
  }, [
    autoRefresh,
    confirm,
    helpOpen,
    profileOpen,
    queueOpen,
    searching,
    params,
    view,
    projectPath,
    reloadOrganizations,
    refresh,
    isLoadingMore,
  ])

  useKeyboard((key) => {
    const action = keyToAction(state as AppState, key.name)
    if (!action) return
    switch (action.type) {
      case "quit":
        renderer.destroy()
        return
      case "refresh":
        refreshAll()
        return
      case "drillIn":
        drillIn()
        return
      case "moveSelection": {
        if (view === "org") {
          const next = clamp(orgIndex + action.delta, orgList.length)
          const picked = orgList[next]
          if (picked) dispatch({ type: "selectOrg", name: picked.name })
        } else if (view === "project") {
          const next = clamp(projectIndex + action.delta, projectList.length)
          const picked = projectList[next]
          if (picked) dispatch({ type: "selectProject", path: picked.path })
        } else if (view === "deploy") {
          const next = clamp(deploymentIndex + action.delta, deployList.length)
          const picked = deployList[next]
          if (picked) dispatch({ type: "selectDeployment", number: picked.number })
        }
        return
      }
      case "clearQuery":
        dispatch({ type: "clearQuery" })
        return
      case "openHelp":
        dispatch({ type: "setHelp", open: true })
        return
      case "closeHelp":
        dispatch({ type: "setHelp", open: false })
        return
      case "openProfiles":
        dispatch({ type: "openProfiles" })
        return
      case "closeProfiles": {
        const picked = profiles[profileIndex]
        if (picked) switchProfile(picked)
        else dispatch({ type: "closeProfiles" })
        return
      }
      case "moveProfile":
        dispatch({ type: "moveProfile", delta: action.delta, count: profiles.length })
        return
      case "triggerBuild":
        buildActions.askBuild(project, params)
        return
      case "stopBuild":
        buildActions.askStop(project, deployment, view === "run" ? run.live : Boolean(deployment?.building))
        return
      case "openConsole":
        openConsole()
        return
      case "copyLink":
        copyLink()
        return
      case "cycleFilter":
        dispatch({ type: "cycleFilter" })
        return
      case "toggleAutoRefresh":
        dispatch({ type: "toggleAutoRefresh" })
        return
      case "confirmYes":
        void buildActions.runConfirmed()
        return
      case "confirmNo":
        dispatch({ type: "clearConfirm" })
        return
      case "openQueue":
        dispatch({ type: "openQueue" })
        return
      case "closeQueue":
        dispatch({ type: "closeQueue" })
        return
      case "moveQueue":
        dispatch({ type: "moveQueue", delta: action.delta, count: queue.items.length })
        return
      case "openQueueItem":
        buildActions.openQueueItem(queue.items[queueIndexClamped])
        return
      case "cancelQueue":
        buildActions.askCancelQueue(queue.items[queueIndexClamped])
        return
      case "closeParams":
        dispatch({ type: "closeParams" })
        return
      case "moveParam":
        dispatch({ type: "moveParam", delta: action.delta, count: params?.fields.length ?? 0 })
        return
      case "startParamEdit":
        dispatch({ type: "setParamEditing", editing: true })
        return
      case "cancelParamEdit":
        dispatch({ type: "setParamEditing", editing: false })
        return
      case "commitParam":
        dispatch({ type: "commitParam" })
        return
      case "enterSearch":
      case "exitSearch":
      case "goBack":
        dispatch(action)
        return
    }
  })

  const meta = VIEW_META[view]
  const breadcrumb = breadcrumbFor(view, org?.name, project?.name, deployment?.name)
  const statusBadge = [
    busy ? "working" : null,
    statusFilter !== "all" ? `filter:${statusFilter}` : null,
    autoRefresh ? "auto" : "manual",
  ]
    .filter(Boolean)
    .join(" · ")

  const q = query.trim()
  const searchHint = q ? ` matching "${q}"` : ""
  // undefined = never fetched, [] = fetched but empty.
  const buildsLoaded = project ? deploymentsByJob[projectPath ?? ""] !== undefined : false
  const modalOpen = helpOpen || profileOpen || !!confirm || queueOpen || !!params
  const runHasContent = run.stages.length > 0 || run.log.length > 0

  const placeholder = (() => {
    if (view === "org") {
      if (loading && orgList.length === 0) return { text: "Loading organizations…" }
      if (error && orgList.length === 0) return { text: error, tone: "error" as const }
      if (orgList.length === 0) return { text: `No organizations${searchHint}` }
      return null
    }
    if (view === "project") {
      if (projectList.length === 0) return { text: `No projects${searchHint}` }
      return null
    }
    if (view === "deploy") {
      if (!buildsLoaded) return { text: "Loading builds…" }
      if (deployList.length === 0) return { text: `No builds${searchHint}` }
      return null
    }
    if (view === "run") {
      if (!deployment && state.selectedDeployment !== null) {
        return buildsLoaded
          ? { text: `Build #${state.selectedDeployment} not found`, tone: "error" as const }
          : { text: "Loading build…" }
      }
      if (run.loading && !runHasContent) return { text: "Loading stage view…" }
      if (run.error && !runHasContent) return { text: run.error, tone: "error" as const }
      if (!runHasContent) return { text: "No stages recorded" }
      return null
    }
    return null
  })()

  const selectOrg = (index: number) => {
    const picked = orgList[index]
    if (picked) dispatch({ type: "selectOrg", name: picked.name })
  }
  const selectProject = (index: number) => {
    const picked = projectList[index]
    if (picked) dispatch({ type: "selectProject", path: picked.path })
  }
  const selectDeployment = (index: number) => {
    const picked = deployList[index]
    if (picked) dispatch({ type: "selectDeployment", number: picked.number })
  }

  return (
    <box style={{ flexDirection: "column", height: "100%" }}>
      <Header title={meta.title} breadcrumb={breadcrumb} profile={activeProfile} status={statusBadge} />
      <SearchBar
        placeholder={meta.placeholder}
        value={query}
        focused={searching && !modalOpen}
        onValueChange={(value) => dispatch({ type: "setQuery", query: value })}
      />
      {notice ? <NoticeBar notice={notice} /> : null}

      {view === "org" &&
        (placeholder ? (
          <Placeholder {...placeholder} />
        ) : (
          <OrgScreen
            organizations={orgList}
            selectedIndex={orgIndex}
            focused={!searching && !modalOpen}
            onChange={selectOrg}
            onSubmit={drillIn}
          />
        ))}

      {view === "project" &&
        (placeholder ? (
          <Placeholder {...placeholder} />
        ) : (
          <ProjectScreen
            projects={projectList}
            selectedIndex={projectIndex}
            focused={!searching && !modalOpen}
            onChange={selectProject}
            onSubmit={drillIn}
          />
        ))}

      {view === "deploy" &&
        (placeholder ? (
          <Placeholder {...placeholder} />
        ) : (
          <DeployScreen
            deployments={deployList}
            selectedIndex={deploymentIndex}
            focused={!searching && !modalOpen}
            onChange={selectDeployment}
            onSubmit={drillIn}
          />
        ))}

      {view === "run" &&
        (placeholder || !deployment ? (
          <Placeholder {...(placeholder ?? { text: "No build selected" })} />
        ) : (
          <RunScreen
            deployment={deployment}
            stages={run.stages}
            log={run.log}
            query={query}
            logFocused={!searching && !modalOpen}
            warning={run.warning}
            live={run.live}
          />
        ))}

      {helpOpen && <HelpDialog />}
      {profileOpen && <ProfileDialog names={profiles} active={activeProfile} selectedIndex={profileIndex} />}
      {queueOpen && <QueueDialog items={queue.items} selectedIndex={queueIndexClamped} loading={queue.loading} />}
      {params && (
        <ParamsDialog
          projectName={params.projectName}
          fields={params.fields}
          index={params.index}
          editing={params.editing}
          onChange={(value) => dispatch({ type: "setParamValue", value })}
        />
      )}
      {/* Confirmation renders last so it stays above the queue and parameter dialogs. */}
      {confirm && <ConfirmDialog action={confirm} busy={busy} />}
    </box>
  )
}
