import { useEffect, useRef, useState } from "react"
import { config } from "../config"
import { JenkinsError, type JenkinsClient } from "../api/jenkins"
import { appendLines, appendLog } from "../utils/log"
import { mergeStages, seedStages } from "../utils/stages"
import type { AnsiStyle, LogLine, Stage, StageStatus } from "../types"

const MAX_BACKOFF_MS = 15_000

/**
 * Owns the stage view and console stream for one build. A failed poll retries
 * with backoff instead of silently ending the "live" stream, and a failed
 * liveness check never pretends the build finished.
 */
export function useRunStream(
  api: JenkinsClient,
  projectPath: string | undefined,
  buildNumber: number | undefined,
  reloadToken: number,
  onFinished: () => void,
) {
  const [stages, setStages] = useState<Stage[]>([])
  const [log, setLog] = useState<LogLine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  // Final result of the streamed build, so callers don't have to infer it from
  // a build list that may still be refreshing.
  const [result, setResult] = useState<StageStatus | null>(null)
  const finished = useRef(false)


  useEffect(() => {
    if (!projectPath || buildNumber === undefined) {
      setLive(false)
      setResult(null)
      return
    }
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let carry = ""
    let style: AnsiStyle = {}
    let offset = 0
    let stagesAvailable = true
    finished.current = false
    setLive(true)
    setResult(null)

    setStages([])
    setLog([])
    setLoading(true)
    setError(null)
    setWarning(null)

    // Seed with the previous build's stage names so a running build shows every
    // stage up front (pending). seedStages never overwrites live data.
    api
      .fetchStageTemplate(projectPath, buildNumber)
      .then((template) => {
        if (active && template.length > 0) setStages((prev) => seedStages(prev, template))
      })
      .catch((err: unknown) => {
        // Freestyle jobs have no workflow API; stop asking for stages.
        if (err instanceof JenkinsError && err.status === 404) stagesAvailable = false
      })

    api
      .fetchStages(projectPath, buildNumber)
      .then((data) => {
        if (active) setStages((prev) => mergeStages(prev, data))
      })
      .catch((err: unknown) => {
        if (err instanceof JenkinsError && err.status === 404) {
          stagesAvailable = false
          return
        }
        if (active) setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    function schedule(delay: number): void {
      if (!active) return
      timer = setTimeout(() => void step(), delay)
    }

    function retry(): void {
      if (!active) return
      failures += 1
      setWarning(`reconnecting… (attempt ${failures})`)
      schedule(Math.min(config.pollIntervalMs * 2 ** failures, MAX_BACKOFF_MS))
    }

    async function step(): Promise<void> {
      const stagesPromise = stagesAvailable
        ? api.fetchStages(projectPath!, buildNumber!).catch((err: unknown) => {
            if (err instanceof JenkinsError && err.status === 404) stagesAvailable = false
            return null
          })
        : Promise.resolve(null)
      const [page, freshStages, buildState] = await Promise.all([
        api.pollLog(projectPath!, buildNumber!, offset).catch(() => null),
        stagesPromise,
        api.fetchBuildState(projectPath!, buildNumber!).catch(() => null),
      ])
      if (!active) return

      if (!page) {
        if (freshStages) setStages((prev) => mergeStages(prev, freshStages))
        retry()
        return
      }

      failures = 0
      setWarning(null)

      // Guard against a log rotation returning a smaller size; never rewind.
      offset = Math.max(offset, page.size)
      const chunk = appendLog(carry, page.text, style)
      carry = chunk.carry
      style = chunk.style
      if (chunk.lines.length > 0) setLog((prev) => appendLines(prev, chunk.lines))
      if (freshStages) setStages((prev) => mergeStages(prev, freshStages))

      // A missing liveness response is unknown, not "finished": keep polling.
      if (!buildState || buildState.building) {
        schedule(config.pollIntervalMs)
        return
      }

      // Build finished: flip any never-run stage to skipped, then let the app
      // refresh the build list so status and commits update.
      setStages((prev) =>
        prev.map((stage) => (stage.status === "PENDING" ? { ...stage, status: "SKIPPED" as const } : stage)),
      )
      setLive(false)
      setResult(buildState.result)
      if (!finished.current) {
        finished.current = true
        onFinished()
      }
    }

    void step().catch(() => retry())

    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [api, projectPath, buildNumber, reloadToken, onFinished])

  return { stages, log, loading, error, warning, live, result }
}
