import { useCallback, useEffect, useState } from "react"
import { config } from "../config"
import type { JenkinsClient, QueueItem } from "../api/jenkins"

/** Loads the build queue while the dialog is open, refreshing until it closes. */
export function useQueue(api: JenkinsClient, open: boolean) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(false)
  const [version, setVersion] = useState(0)


  useEffect(() => {
    if (!open) return
    let active = true
    const load = () => {
      setLoading(true)
      api
        .fetchQueue()
        .then((next) => {
          if (active) setItems(next)
        })
        .catch(() => {
          if (active) setItems([])
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }
    load()
    const timer = setInterval(load, Math.min(config.autoRefreshMs, 3000))
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [api, open, version])

  const reload = useCallback(() => setVersion((value) => value + 1), [])

  return { items, loading, reload }
}
