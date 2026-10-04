import { useCallback, useEffect, useRef, useState } from "react"
import type { Organization } from "../types"
import { fetchOrganizations } from "../api/jenkins"
import { getActiveProfileName } from "../config"

export function useOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Only the newest request may write state, so a slow earlier response (e.g.
  // from the previous profile) can never overwrite a newer one.
  const requestId = useRef(0)

  const reload = useCallback((options?: { silent?: boolean }) => {
    const id = ++requestId.current
    const profile = getActiveProfileName()
    const silent = options?.silent ?? false
    console.debug(`[orgs] reload #${id} profile=${profile}${silent ? " (silent)" : ""}`)
    if (!silent) {
      setLoading(true)
      setError(null)
      // Clear immediately so the UI shows loading instead of the old profile's data.
      setOrganizations([])
    }
    fetchOrganizations()
      .then((data) => {
        if (id !== requestId.current) {
          console.debug(`[orgs] #${id} stale (current #${requestId.current}), dropped`)
          return
        }
        console.debug(`[orgs] #${id} profile=${profile} orgs=${data.length} projects=${data.reduce((n, o) => n + o.projects.length, 0)}`)
        setOrganizations(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return
        console.error(`[orgs] #${id} failed:`, err instanceof Error ? err.message : err)
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { organizations, loading, error, reload }
}
