import { useCallback, useEffect, useRef, useState } from "react"
import { PAGE_SIZE, type JenkinsClient } from "../api/jenkins"
import type { Deployment, View } from "../types"

type DeploymentsState = Record<string, Deployment[]>
type ExhaustedState = Record<string, boolean>

// Fetches a page of builds and their commit counts together, so the list is
// complete on arrival and there is no lazy-loading race to reconcile. The
// client caches commit counts, so growing the window does not refetch history.
async function loadPage(api: JenkinsClient, jobPath: string, limit: number): Promise<Deployment[]> {
  const builds = await api.fetchBuildPage(jobPath, limit)
  const counts = await api.fetchCommitCounts(jobPath, builds)
  return builds.map((build) => ({ ...build, commits: counts.get(build.number) ?? 0 }))
}

/**
 * Owns the build history cache. Refreshes preserve the number of rows already
 * loaded, so auto-refresh can never collapse a 300-build scroll back to 100.
 */
export function useDeployments(
  api: JenkinsClient,
  view: View,
  projectPath: string | undefined,
  selectedDeployment: number | null,
  reloadToken: number,
) {
  const [deploymentsByJob, setDeploymentsByJob] = useState<DeploymentsState>({})
  const [exhausted, setExhausted] = useState<ExhaustedState>({})

  // Refs keep the callbacks stable without depending on every list update.
  const current = useRef<DeploymentsState>({})
  current.current = deploymentsByJob
  const loadingMore = useRef<Set<string>>(new Set())
  // Each load gets a generation. A slow auto-refresh must never overwrite a
  // newer page that already grew the list.
  const generation = useRef<Record<string, number>>({})

  const beginLoad = useCallback((jobPath: string): number => {
    const next = (generation.current[jobPath] ?? 0) + 1
    generation.current[jobPath] = next
    return next
  }, [])

  const isCurrent = useCallback((jobPath: string, gen: number): boolean => {
    return generation.current[jobPath] === gen
  }, [])

  // A new client means a new profile: drop everything from the old server.

  useEffect(() => {
    setDeploymentsByJob({})
    setExhausted({})
    current.current = {}
    loadingMore.current.clear()
    generation.current = {}
  }, [api])

  const setPage = useCallback((jobPath: string, builds: Deployment[], limit: number) => {
    setDeploymentsByJob((prev) => ({ ...prev, [jobPath]: builds }))
    setExhausted((prev) => ({ ...prev, [jobPath]: builds.length < limit }))
  }, [])

  /** Refresh one job, keeping at least as many rows as the user already loaded. */
  const refresh = useCallback(
    async (jobPath: string): Promise<Deployment[]> => {
      const loaded = current.current[jobPath]?.length ?? 0
      const limit = Math.max(PAGE_SIZE, loaded)
      const gen = beginLoad(jobPath)
      const builds = await loadPage(api, jobPath, limit)
      if (isCurrent(jobPath, gen)) setPage(jobPath, builds, limit)
      return builds
    },
    [api, beginLoad, isCurrent, setPage],
  )

  // Load the first page once a project is actually opened (deploy/run). Loading
  // while merely browsing the project list fires a fetch for every highlighted
  // row, which stutters fast j/k navigation.
  useEffect(() => {
    if (view !== "deploy" && view !== "run") return
    if (!projectPath) return
    if (reloadToken === 0 && current.current[projectPath]) return
    let active = true
    const limit = Math.max(PAGE_SIZE, current.current[projectPath]?.length ?? 0)
    const gen = beginLoad(projectPath)
    loadPage(api, projectPath, limit)
      .then((builds) => {
        if (active && isCurrent(projectPath, gen)) setPage(projectPath, builds, limit)
      })
      .catch(() => {
        if (active && isCurrent(projectPath, gen) && current.current[projectPath] === undefined) {
          setDeploymentsByJob((prev) => ({ ...prev, [projectPath]: [] }))
        }
      })
    return () => {
      active = false
    }
  }, [api, view, projectPath, reloadToken, setPage, beginLoad, isCurrent])

  // Infinite scroll: when the highlighted build nears the end of the loaded
  // list, grow the window. Jenkins has no offset window for allBuilds, so this
  // simply asks for the newest N and marks the history exhausted when a larger N
  // returns the same number of builds.
  useEffect(() => {
    if (view !== "deploy" || !projectPath) return
    const loaded = deploymentsByJob[projectPath] ?? []
    if (loaded.length === 0 || exhausted[projectPath]) return
    // Treat "no selection yet" and "selected build filtered out" as position 0:
    // only a selection that is actually near the loaded end should page in more.
    const selectedIndex = loaded.findIndex((build) => build.number === selectedDeployment)
    if (selectedIndex === -1 || selectedIndex < loaded.length - 5) return
    if (loadingMore.current.has(projectPath)) return
    loadingMore.current.add(projectPath)
    let active = true
    const limit = loaded.length + PAGE_SIZE
    const gen = beginLoad(projectPath)
    loadPage(api, projectPath, limit)
      .then((next) => {
        if (!active || !isCurrent(projectPath, gen)) return
        if (next.length <= loaded.length) {
          setExhausted((prev) => ({ ...prev, [projectPath]: true }))
          return
        }
        setPage(projectPath, next, limit)
      })
      .catch(() => {})
      .finally(() => {
        loadingMore.current.delete(projectPath)
      })
    return () => {
      active = false
    }
  }, [api, view, projectPath, selectedDeployment, deploymentsByJob, exhausted, setPage, beginLoad, isCurrent])

  const isLoadingMore = useCallback((jobPath: string) => loadingMore.current.has(jobPath), [])

  return { deploymentsByJob, refresh, isLoadingMore }
}
