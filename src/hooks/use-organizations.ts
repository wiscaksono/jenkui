import { useCallback, useEffect, useRef, useState } from "react"
import type { Organization } from "../types"
import type { JenkinsClient } from "../api/jenkins"
import { readCache, writeCache } from "../utils/cache"

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export function useOrganizations(api: JenkinsClient, cacheKey: string) {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Only the newest request may write state, so a slow earlier response (e.g.
  // from the previous profile) can never overwrite a newer one.
  const requestId = useRef(0)
  const inFlight = useRef(false)
  const currentOrgs = useRef<Organization[]>([])
  currentOrgs.current = organizations

  const reload = useCallback(
    (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false
      // Auto-refresh should not stack requests on a slow Jenkins.
      if (silent && inFlight.current) return
      const id = ++requestId.current
      const profile = api.profile.url
      const key = `orgs-${cacheKey}-${profile}-${api.profile.user}`
      const cachedRaw = silent ? null : readCache<Organization[]>(key, CACHE_TTL_MS)
      const cached = Array.isArray(cachedRaw) ? cachedRaw : null
      if (!silent) {
        setLoading(true)
        setError(null)
        // Show the previous tree immediately, then replace it with fresh data.
        setOrganizations(cached ?? [])
      }
      console.debug(`[orgs] reload #${id} profile=${profile}${silent ? " (silent)" : ""}${cached ? " (cached)" : ""}`)
      inFlight.current = true
      api
        .fetchOrganizations()
        .then(({ organizations: data, partial }) => {
          if (id !== requestId.current) {
            console.debug(`[orgs] #${id} stale (current #${requestId.current}), dropped`)
            return
          }
          console.debug(
            `[orgs] #${id} profile=${profile} orgs=${data.length} projects=${data.reduce(
              (n, org) => n + org.projects.length,
              0,
            )}${partial ? " (partial)" : ""}`,
          )
          // A failed fetch of every view reports zero organizations. Keep the
          // previous tree instead of replacing it with an empty screen.
          if (partial && data.length === 0 && currentOrgs.current.length > 0) {
            setError("Jenkins views could not be loaded. Showing the previous tree.")
            setLoading(false)
            return
          }
          setOrganizations(data)
          setLoading(false)
          setError(partial ? "Some Jenkins views could not be loaded. Showing partial data." : null)
          // Silent auto-refresh hits Jenkins every few seconds; writing the
          // whole tree each time would hammer the disk for no benefit. Partial
          // trees are not written, so a transient failure cannot poison the cache.
          if (!silent && !partial) writeCache(key, data)
        })
        .catch((err: unknown) => {
          if (id !== requestId.current) return
          console.error(`[orgs] #${id} failed:`, err instanceof Error ? err.message : err)
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        })
        .finally(() => {
          if (id === requestId.current) inFlight.current = false
        })
    },
    [api, cacheKey],
  )

  useEffect(() => {
    reload()
  }, [reload])

  return { organizations, loading, error, reload }
}
