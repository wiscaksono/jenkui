import { useEffect, useRef } from "react"
import type { ScrollBoxRenderable } from "@opentui/core"
import { colors, statusColor } from "../config/theme"
import { formatDuration } from "../utils/format"
import { useSpinner } from "../hooks/use-spinner"
import type { Deployment, Stage, StageStatus } from "../types"

type RunScreenProps = {
  deployment: Deployment
  stages: Stage[]
  log: string[]
  query: string
  logFocused: boolean
}

const STATUS_GLYPH: Record<StageStatus, string> = {
  SUCCESS: "\u{f00c}",
  FAILURE: "\u{f00d}",
  RUNNING: "\u{f04b}",
  SKIPPED: "\u{f068}",
  PENDING: "\u{f10c}",
}

const BAR_FILL = "#3A6EA5"

type Segment = { text: string; hit: boolean }

function highlight(text: string, q: string): Segment[] {
  if (!q) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const segments: Segment[] = []
  let cursor = 0
  let index = lower.indexOf(q)
  while (index !== -1) {
    if (index > cursor) segments.push({ text: text.slice(cursor, index), hit: false })
    segments.push({ text: text.slice(index, index + q.length), hit: true })
    cursor = index + q.length
    index = lower.indexOf(q, cursor)
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false })
  return segments.length ? segments : [{ text, hit: false }]
}

export function RunScreen({ deployment, stages, log, query, logFocused }: RunScreenProps) {
  const rows = stages
  const max = Math.max(...rows.map((r) => r.durationMs), 1)
  const q = query.trim().toLowerCase()
  const title = deployment.building ? ` Console Output — ${deployment.name}  ● live ` : ` Console Output — ${deployment.name} `

  const spinner = useSpinner(rows.some((r) => r.status === "RUNNING"))

  const logRef = useRef<ScrollBoxRenderable>(null)

  useEffect(() => {
    if (logFocused) logRef.current?.focus()
    else logRef.current?.blur()
  }, [logFocused])

  const logEntries = log.map((line) => ({ time: "", line }))

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <box style={{ flexDirection: "row", alignItems: "flex-start", gap: 1, flexShrink: 0 }}>
        {rows.map((stage) => (
          <box
            key={stage.name}
            border
            borderStyle="rounded"
            borderColor={statusColor[stage.status]}
            style={{ flexDirection: "column", flexGrow: 1, flexBasis: 0, minWidth: 0, height: 5, paddingX: 1 }}
          >
            <box style={{ flexDirection: "row", justifyContent: "space-between", gap: 3 }}>
              <text fg={statusColor[stage.status]} truncate wrapMode="none">
                {stage.name}
              </text>
              <box style={{ flexDirection: "row", alignItems: "center", gap: 1, flexShrink: 0 }}>
                <text fg={statusColor[stage.status]}>
                  {stage.status === "RUNNING" ? spinner : STATUS_GLYPH[stage.status]}
                </text>
                <text fg={colors.muted}>{formatDuration(stage.durationMs)}</text>
              </box>
            </box>
            <box style={{ flexDirection: "row", marginTop: 1 }}>
              <box
                style={{
                  flexGrow: Math.max(stage.durationMs, 1),
                  flexBasis: 0,
                  minWidth: 0,
                  height: 1,
                  backgroundColor: stage.status === "FAILURE" ? colors.failure : BAR_FILL,
                }}
              />
              <box
                style={{
                  flexGrow: Math.max(max - stage.durationMs, 0),
                  flexBasis: 0,
                  minWidth: 0,
                  height: 1,
                  backgroundColor: "#333333",
                }}
              />
            </box>
          </box>
        ))}
      </box>

      <box
        title={title}
        titleAlignment="left"
        style={{ border: true, flexDirection: "column", flexGrow: 1, minHeight: 0, borderColor: colors.faint, borderStyle: "rounded" }}
      >
        <scrollbox ref={logRef} stickyScroll stickyStart="bottom" style={{ flexGrow: 1, paddingX: 1 }}>
          {(logEntries.length ? logEntries : [{ time: "", line: "(no output)" }]).map((entry, i) => {
            const isError = entry.line.startsWith("ERROR") || entry.line.startsWith("error")
            const segments = highlight(entry.line, q)
            return (
              <box key={i} style={{ flexDirection: "row", gap: 1 }}>
                <text fg={colors.faint}>{entry.time}</text>
                <box style={{ flexDirection: "row" }}>
                  {segments.map((seg, j) => (
                    <text key={j} fg={seg.hit ? colors.accent : isError ? colors.failure : colors.muted}>
                      {seg.text}
                    </text>
                  ))}
                </box>
              </box>
            )
          })}
        </scrollbox>
      </box>
    </box>
  )
}
