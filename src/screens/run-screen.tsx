import { memo, useEffect, useMemo, useRef } from "react"
import type { ScrollBoxRenderable } from "@opentui/core"
import { useTheme } from "../config/theme"
import { formatDuration } from "../utils/format"
import { useSpinner } from "../hooks/use-spinner"
import { highlightSpans, spansToString } from "../utils/log"
import type { AnsiSpan, Deployment, LogLine, Stage, StageStatus } from "../types"
import type { ThemeColor } from "../config/themes"

type RunScreenProps = {
  deployment: Deployment
  stages: Stage[]
  log: LogLine[]
  query: string
  logFocused: boolean
  warning?: string | null
  live?: boolean
}

const STATUS_GLYPH: Record<StageStatus, string> = {
  SUCCESS: "\u{f00c}",
  FAILURE: "\u{f00d}",
  RUNNING: "\u{f04b}",
  ABORTED: "\u{f05e}",
  UNSTABLE: "\u{f071}",
  PAUSED: "\u{f04c}",
  SKIPPED: "\u{f068}",
  PENDING: "\u{f10c}",
}

/** Animated glyph isolated in its own component, so only this text ticks at 10fps. */
function RunningSpinner({ color }: { color: ThemeColor }) {
  const frame = useSpinner(true)
  return <text fg={color}>{frame}</text>
}

const StageCard = memo(function StageCard({ stage, max }: { stage: Stage; max: number }) {
  const { colors, statusColor } = useTheme()
  return (
    <box
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
          {stage.status === "RUNNING" ? (
            <RunningSpinner color={statusColor[stage.status]} />
          ) : (
            <text fg={statusColor[stage.status]}>{STATUS_GLYPH[stage.status]}</text>
          )}
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
            backgroundColor: stage.status === "FAILURE" ? colors.failure : colors.accent,
          }}
        />
        <box
          style={{
            flexGrow: Math.max(max - stage.durationMs, 0),
            flexBasis: 0,
            minWidth: 0,
            height: 1,
            backgroundColor: colors.selectionDim,
          }}
        />
      </box>
    </box>
  )
})

const LogLineView = memo(function LogLineView({ spans, query }: { spans: AnsiSpan[]; query: string }) {
  const { colors, ansiColor } = useTheme()
  const marked = useMemo(() => highlightSpans(spans, query), [spans, query])
  const plain = useMemo(() => spansToString(spans), [spans])
  const isError = plain.startsWith("ERROR") || plain.startsWith("error")
  return (
    <box style={{ flexDirection: "row" }}>
      {marked.map((span, index) => (
        <text
          key={index}
          fg={span.hit ? colors.accent : (ansiColor(span.style.fg) ?? (isError ? colors.failure : colors.muted))}
        >
          {span.text}
        </text>
      ))}
    </box>
  )
})

const EMPTY_LOG: LogLine = [{ text: "(no output)", style: {} }]

const LogView = memo(function LogView({
  log,
  query,
  focused,
  title,
}: {
  log: LogLine[]
  query: string
  focused: boolean
  title: string
}) {
  const { colors } = useTheme()
  const ref = useRef<ScrollBoxRenderable>(null)

  useEffect(() => {
    if (focused) ref.current?.focus()
    else ref.current?.blur()
  }, [focused])

  const lines = log.length > 0 ? log : [EMPTY_LOG]
  return (
    <box
      title={title}
      titleAlignment="left"
      style={{
        border: true,
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
        borderColor: colors.faint,
        borderStyle: "rounded",
      }}
    >
      <scrollbox ref={ref} stickyScroll stickyStart="bottom" style={{ flexGrow: 1, paddingX: 1 }}>
        {lines.map((spans, index) => (
          <LogLineView key={index} spans={spans} query={query} />
        ))}
      </scrollbox>
    </box>
  )
})

export function RunScreen({ deployment, stages, log, query, logFocused, warning, live }: RunScreenProps) {
  const max = Math.max(...stages.map((stage) => stage.durationMs), 1)
  const badge = live ? (warning ? "  ● reconnecting " : "  ● live ") : ""
  const title = ` Console Output — ${deployment.name}${badge} `

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      <box style={{ flexDirection: "row", alignItems: "flex-start", gap: 1, flexShrink: 0 }}>
        {stages.map((stage) => (
          <StageCard key={stage.name} stage={stage} max={max} />
        ))}
      </box>

      <LogView log={log} query={query} focused={logFocused} title={title} />
    </box>
  )
}
