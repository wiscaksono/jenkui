import { useKeyboard, useRenderer } from "@opentui/react"
import { useCallback, useEffect, useReducer, useState } from "react"
import { Header } from "./components/header"
import { HelpDialog } from "./components/help-dialog"
import { Placeholder } from "./components/placeholder"
import { ProfileDialog } from "./components/profile-dialog"
import { ConfirmDialog } from "./components/confirm-dialog"
import { QueueDialog } from "./components/queue-dialog"
import { SearchBar } from "./components/search-bar"
import { useOrganizations } from "./hooks/use-organizations"
import { useSelection } from "./hooks/use-selection"
import {
  PAGE_SIZE,
  buildConsoleUrl,
  fetchBuildPage,
  fetchBuildState,
  fetchCommitCounts,
  fetchQueue,
  fetchStages,
  fetchStageTemplate,
  jobUrl,
  pollLog,
  stopBuild,
  triggerBuild,
  type QueueItem,
} from "./api/jenkins"
import { appendLog } from "./utils/log"
import { mergeStages, seedStages } from "./utils/stages"
import { copyToClipboard, openInBrowser } from "./utils/host"
import { DeployScreen } from "./screens/deploy-screen"
import { OrgScreen } from "./screens/org-screen"
import { ProjectScreen } from "./screens/project-screen"
import { RunScreen } from "./screens/run-screen"
import { initialState, reducer, type AppState } from "./state/store"
import { keyToAction } from "./state/keymap"
import { config, getActiveProfileName, profileNames, setActiveProfile } from "./config"
import type { Deployment, Stage } from "./types"
import { VIEW_META, breadcrumbFor } from "./state/views"

// Fetches a page of builds and their commit counts together, so the list is
// complete on arrival and there is no lazy-loading race to reconcile.
async function loadPage(jobPath: string, limit: number): Promise<Deployment[]> {
  const builds = await fetchBuildPage(jobPath, limit)
  const counts = await fetchCommitCounts(
    jobPath,
    builds.map((b) => b.number),
  )
  return builds.map((b) => ({ ...b, commits: counts.get(b.number) ?? 0 }))
}

const clamp = (index: number, length: number) => Math.max(0, Math.min(index, length - 1))

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const renderer = useRenderer()
  const { view, mode, queries, helpOpen, profileOpen, profileIndex, confirm, busy, statusFilter, autoRefresh, queueOpen, queueIndex } = state
  const searching = mode === "search"
  const query = queries[view] ?? ""

  const { organizations, loading, error, reload: reloadOrganizations } = useOrganizations()
  const [deploymentsByJob, setDeploymentsByJob] = useState<Record<string, Deployment[]>>({})
  const [stages, setStages] = useState<Stage[]>([])
  const [log, setLog] = useState<string[]>([])
  const [runLoading, setRunLoading] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [activeProfile, setActiveProfileState] = useState(getActiveProfileName())
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const [queueLoading, setQueueLoading] = useState(false)
  const profiles = profileNames()

  const { orgList, org, orgIndex, projectList, project, projectIndex, deployList, deployment, deploymentIndex } =
    useSelection(state, organizations, deploymentsByJob)

  const orgName = org?.name
  const projectName = project?.name
  const projectPath = project?.path
  const deploymentNumber = deployment?.number

  // Load the first page of build history (with commit counts) once a project is
  // actually opened (deploy/run). Loading while merely browsing the project list
  // fires a fetch for every highlighted row, which stutters fast j/k navigation.
  useEffect(() => {
    if (view !== "deploy" && view !== "run") return
    if (!projectPath) return
    if (reloadToken === 0 && deploymentsByJob[projectPath]) return
    let active = true
    loadPage(projectPath, PAGE_SIZE)
      .then((builds) => {
        if (active) setDeploymentsByJob((prev) => ({ ...prev, [projectPath]: builds }))
      })
      .catch(() => {
        if (active) setDeploymentsByJob((prev) => ({ ...prev, [projectPath]: [] }))
      })
    return () => {
      active = false
    }
  }, [view, projectPath, reloadToken])

  // Load stage view, then stream console output while the build keeps producing.
  useEffect(() => {
    if (view !== "run" || !projectPath || deploymentNumber === undefined) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined

    setStages([])
    setLog([])
    setRunLoading(true)
    setRunError(null)

    // Seed with the previous build's stage names so a running build shows every
    // stage up front (pending). seedStages never overwrites live data.
    fetchStageTemplate(projectPath, deploymentNumber)
      .then((template) => {
        if (active && template.length > 0) setStages((prev) => seedStages(prev, template))
      })
      .catch(() => { })

    fetchStages(projectPath, deploymentNumber)
      .then((data) => {
        if (active) setStages((prev) => mergeStages(prev, data))
      })
      .catch((err: unknown) => {
        if (active) setRunError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (active) setRunLoading(false)
      })

    let carry = ""
    let offset = 0
    const step = async () => {
      // Refresh stage durations/status, log tail, and liveness every tick.
      // This Jenkins reports X-More-Data:true even for finished builds, so the
      // build's own `building` flag decides when to stop.
      const [page, freshStages, buildState] = await Promise.all([
        pollLog(projectPath, deploymentNumber, offset),
        fetchStages(projectPath, deploymentNumber).catch(() => null),
        fetchBuildState(projectPath, deploymentNumber).catch(() => null),
      ])
      if (!active) return

      offset = page.size
      const chunk = appendLog(carry, page.text)
      carry = chunk.carry
      if (chunk.lines.length > 0) setLog((prev) => [...prev, ...chunk.lines])
      if (freshStages) setStages((prev) => mergeStages(prev, freshStages))

      if (buildState?.building) {
        timer = setTimeout(() => void step(), config.pollIntervalMs)
      } else {
        // Build finished: flip any never-run stage to skipped, then refresh the
        // build list so status + commits update.
        setStages((prev) =>
          prev.map((stage) => (stage.status === "PENDING" ? { ...stage, status: "SKIPPED" as const } : stage)),
        )
        loadPage(projectPath, PAGE_SIZE)
          .then((builds) => {
            if (active) setDeploymentsByJob((prev) => ({ ...prev, [projectPath]: builds }))
          })
          .catch(() => {})
      }
    }
    void step()

    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [view, projectPath, deploymentNumber, reloadToken])

  // Commit the visible selection before drilling so it survives the query reset.
  const drillIn = useCallback(() => {
    if (view === "org" && org) dispatch({ type: "selectOrg", name: org.name })
    else if (view === "project" && project) dispatch({ type: "selectProject", path: project.path })
    else if (view === "deploy" && deployment) dispatch({ type: "selectDeployment", number: deployment.number })
    dispatch({ type: "drillIn" })
  }, [view, org, project, deployment])

  // Infinite scroll: when the highlighted build nears the end of the loaded
  // list, fetch more history for this job by growing the limit.
  useEffect(() => {
    if (view !== "deploy" || !projectPath) return
    const loaded = deploymentsByJob[projectPath] ?? []
    if (loaded.length === 0) return
    if (deploymentIndex < loaded.length - 5) return
    let active = true
    loadPage(projectPath, loaded.length + PAGE_SIZE)
      .then((next) => {
        if (!active || next.length <= loaded.length) return
        // loadPage returns a complete list (with fresh commit counts), so just
        // replace it; there is no partial state to reconcile.
        setDeploymentsByJob((prev) => ({ ...prev, [projectPath]: next }))
      })
      .catch(() => { })
    return () => {
      active = false
    }
  }, [view, projectPath, deploymentIndex, deploymentsByJob])

  function switchProfile(name: string) {
    if (name === activeProfile) {
      dispatch({ type: "closeProfiles" })
      return
    }
    console.debug(`[profile] switch ${activeProfile} -> ${name}`)
    setActiveProfile(name)
    setActiveProfileState(name)
    // Drop all cached data from the previous server and reload from scratch.
    setDeploymentsByJob({})
    setStages([])
    setLog([])
    setReloadToken((n) => n + 1)
    reloadOrganizations()
    dispatch({ type: "resetForProfile" })
    dispatch({ type: "closeProfiles" })
  }

  const reloadAll = useCallback(() => {
    setReloadToken((n) => n + 1)
    reloadOrganizations()
  }, [reloadOrganizations])

  // Ask to build the highlighted project (deploy/run) or, in run, rebuild the
  // current job. Uses the visible selection so it always targets what's on screen.
  function askBuild() {
    if (!project) return
    dispatch({
      type: "askConfirm",
      action: {
        kind: "build",
        label: `Start a new build of ${project.name}?`,
        profile: activeProfile,
        url: jobUrl(project.path),
      },
    })
  }

  function askStop() {
    if (!project || !deployment || !deployment.building) return
    dispatch({
      type: "askConfirm",
      action: {
        kind: "stop",
        label: `Abort ${project.name} ${deployment.name}?`,
        profile: activeProfile,
        url: buildConsoleUrl(project.path, deployment.number),
      },
    })
  }

  async function runConfirmed() {
    if (!confirm || !project) return
    const action = confirm
    dispatch({ type: "clearConfirm" })
    dispatch({ type: "setBusy", busy: true })
    try {
      if (action.kind === "build") {
        await triggerBuild(project.path)
        console.debug(`[write] triggered build for ${project.path}`)
      } else if (deployment) {
        await stopBuild(project.path, deployment.number)
        console.debug(`[write] stopped ${project.path} #${deployment.number}`)
      }
      // Give Jenkins a moment, then refresh so the new/aborted build shows up.
      setTimeout(() => {
        if (project) {
          setDeploymentsByJob((prev) => {
            const next = { ...prev }
            delete next[project.path]
            return next
          })
        }
        reloadAll()
        dispatch({ type: "setBusy", busy: false })
      }, 2500)
    } catch (err) {
      console.error(`[write] failed:`, err instanceof Error ? err.message : err)
      dispatch({ type: "setBusy", busy: false })
    }
  }

  function openConsole() {
    if (view === "run" && project && deployment) {
      openInBrowser(buildConsoleUrl(project.path, deployment.number))
      return
    }
    if (project) openInBrowser(jobUrl(project.path))
  }

  function copyLink() {
    const url =
      view === "run" && project && deployment ? buildConsoleUrl(project.path, deployment.number) : project ? jobUrl(project.path) : undefined
    if (!url) return
    const ok = copyToClipboard(renderer, url)
    console.debug(`[clip] ${ok ? "copied" : "failed"}: ${url}`)
  }

  // Auto-refresh the org/project data on an interval while the UI is idle.
  // Uses a silent reload so the list is swapped in place without a flicker.
  useEffect(() => {
    if (!autoRefresh) return
    if (confirm || helpOpen || profileOpen || queueOpen || searching) return
    const timer = setInterval(() => {
      reloadOrganizations({ silent: true })
      if (projectPath) {
        loadPage(projectPath, PAGE_SIZE)
          .then((builds) => setDeploymentsByJob((prev) => ({ ...prev, [projectPath]: builds })))
          .catch(() => {})
      }
    }, config.autoRefreshMs)
    return () => clearInterval(timer)
  }, [autoRefresh, confirm, helpOpen, profileOpen, searching, projectPath, reloadOrganizations])

  // Load the queue while its dialog is open, refreshing until it closes.
  useEffect(() => {
    if (!queueOpen) return
    let active = true
    const load = () => {
      setQueueLoading(true)
      fetchQueue()
        .then((items) => {
          if (active) setQueueItems(items)
        })
        .catch(() => {
          if (active) setQueueItems([])
        })
        .finally(() => {
          if (active) setQueueLoading(false)
        })
    }
    load()
    const timer = setInterval(load, config.autoRefreshMs)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [queueOpen])

  useKeyboard((key) => {
    const action = keyToAction(state as AppState, key.name)
    if (!action) return
    switch (action.type) {
      case "quit":
        renderer.destroy()
        return
      case "refresh":
        setReloadToken((n) => n + 1)
        reloadOrganizations()
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
        askBuild()
        return
      case "stopBuild":
        askStop()
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
        void runConfirmed()
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
        dispatch({ type: "moveQueue", delta: action.delta, count: queueItems.length })
        return
      case "enterSearch":
      case "exitSearch":
      case "goBack":
        dispatch(action)
        return
    }
  })

  const meta = VIEW_META[view]
  const breadcrumb = breadcrumbFor(view, orgName, projectName, deployment?.name)
  const statusBadge = [
    statusFilter !== "all" ? `filter:${statusFilter}` : null,
    autoRefresh ? "auto" : "manual",
  ]
    .filter(Boolean)
    .join(" · ")

  const q = query.trim()
  const searchHint = q ? ` matching "${q}"` : ""
  // undefined = never fetched, [] = fetched but empty.
  const buildsLoaded = project ? deploymentsByJob[projectPath ?? ""] !== undefined : false

  const placeholder = (() => {
    if (view === "org") {
      if (loading) return { text: "Loading organizations…" }
      if (error) return { text: error, tone: "error" as const }
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
      if (runLoading) return { text: "Loading stage view…" }
      if (runError) return { text: runError, tone: "error" as const }
      if (stages.length === 0) return { text: "No stages recorded" }
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
        focused={searching && !helpOpen && !profileOpen && !confirm && !queueOpen}
        onValueChange={(value) => dispatch({ type: "setQuery", query: value })}
      />

      {view === "org" &&
        (placeholder ? (
          <Placeholder {...placeholder} />
        ) : (
          <OrgScreen
            organizations={orgList}
            selectedIndex={orgIndex}
            focused={!searching && !helpOpen && !profileOpen && !confirm && !queueOpen}
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
            focused={!searching && !helpOpen && !profileOpen && !confirm && !queueOpen}
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
            focused={!searching && !helpOpen && !profileOpen && !confirm && !queueOpen}
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
            stages={stages}
            log={log}
            query={query}
            logFocused={!searching && !helpOpen && !profileOpen && !confirm && !queueOpen}
          />
        ))}

      {helpOpen && <HelpDialog />}
      {profileOpen && <ProfileDialog names={profiles} active={activeProfile} selectedIndex={profileIndex} />}
      {confirm && <ConfirmDialog action={confirm} busy={busy} />}
      {queueOpen && <QueueDialog items={queueItems} selectedIndex={queueIndex} loading={queueLoading} />}
    </box>
  )
}
