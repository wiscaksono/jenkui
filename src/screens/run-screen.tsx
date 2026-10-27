import { memo, useEffect, useMemo, useRef } from "react"
import type { ScrollBoxRenderable } from "@opentui/core"
import { useTheme } from "../config/theme"
import { useLayout } from "../config/layout"
import { formatDuration } from "../utils/format"
import { useSpinner, useSpinnerTick } from "../hooks/use-spinner"
import { progressBar, stageRatio } from "../utils/progress"
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

/** One cell of wave every 200ms reads as movement without flickering. */
const WAVE_TICKS = 2

/**
 * Solid up to the progress point, full braille for what is left, with the head
 * cell pulsing in the fill color while the stage runs. A null ratio means the
 * length is unknown, so the whole row scrolls the wave instead.
 */
function StageBar({
  ratio,
  width,
  color,
  animate,
}: {
  ratio: number | null
  width: number
  color: ThemeColor
  animate: boolean
}) {
  const { colors } = useTheme()
  const tick = useSpinnerTick(animate)
  const bar = progressBar(ratio, width, Math.floor(tick / WAVE_TICKS))
  return (
    <box style={{ flexDirection: "row" }}>
      {bar.fill ? (
        <text fg={color} wrapMode="none">
          {bar.fill}
        </text>
      ) : null}
      {bar.head ? (
        <text fg={animate ? color : colors.faint} wrapMode="none">
          {bar.head}
        </text>
      ) : null}
      {bar.rail ? (
        <text fg={colors.faint} wrapMode="none">
          {bar.rail}
        </text>
      ) : null}
    </box>
  )
}

const StageCard = memo(function StageCard({ stage, barWidth }: { stage: Stage; barWidth: number }) {
  const { colors, statusColor } = useTheme()
  const running = stage.status === "RUNNING"
  // Finished stages are full and stages that never ran stay empty; only the
  // running one needs a guessed ratio.
  const ratio = running
    ? stageRatio(stage.durationMs, stage.estimateMs)
    : stage.status === "PENDING" || stage.status === "SKIPPED"
      ? 0
      : 1
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
      <box style={{ height: 1, marginTop: 1 }}>
        <StageBar ratio={ratio} width={barWidth} color={statusColor[stage.status]} animate={running} />
      </box>
    </box>
  )
})

const StageRow = memo(function StageRow({ stage }: { stage: Stage }) {
  const { colors, statusColor } = useTheme()
  return (
    <box style={{ flexDirection: "row", alignItems: "center", gap: 1, paddingX: 1, flexShrink: 0 }}>
      {stage.status === "RUNNING" ? (
        <RunningSpinner color={statusColor[stage.status]} />
      ) : (
        <text fg={statusColor[stage.status]}>{STATUS_GLYPH[stage.status]}</text>
      )}
      <text
        fg={statusColor[stage.status]}
        truncate
        wrapMode="none"
        style={{ flexGrow: 1, flexShrink: 1, minWidth: 0 }}
      >
        {stage.name}
      </text>
      <text fg={colors.muted} wrapMode="none">
        {formatDuration(stage.durationMs)}
      </text>
    </box>
  )
})

const StageList = memo(function StageList({ stages }: { stages: Stage[] }) {
  const layout = useLayout()
  const { colors } = useTheme()
  if (stages.length === 0) return null
  const rows = Math.min(stages.length, layout.short ? 3 : 5)
  return (
    <scrollbox
      stickyScroll
      stickyStart="bottom"
      viewportCulling
      style={{ height: rows, flexShrink: 0 }}
      scrollbarOptions={{
        trackOptions: { backgroundColor: colors.background, foregroundColor: colors.faint },
      }}
    >
      {stages.map((stage) => (
        <StageRow key={stage.name} stage={stage} />
      ))}
    </scrollbox>
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
      <scrollbox
        ref={ref}
        stickyScroll
        stickyStart="bottom"
        style={{ flexGrow: 1, paddingX: 1 }}
        scrollbarOptions={{
          trackOptions: { backgroundColor: colors.background, foregroundColor: colors.faint },
        }}
      >
        {lines.map((spans, index) => (
          <LogLineView key={index} spans={spans} query={query} />
        ))}
      </scrollbox>
    </box>
  )
})

export function RunScreen({ deployment, stages, log, query, logFocused, warning, live }: RunScreenProps) {
  const layout = useLayout()
  const badge = live ? (warning ? "  ● reconnecting " : "  ● live ") : ""
  const title = layout.narrow
    ? ` Console ${deployment.name}${badge} `
    : ` Console Output — ${deployment.name}${badge} `
  const useCards = layout.stageCards(stages.length) && !layout.short
  // Cards share the row evenly; each one spends 4 columns on border + padding.
  const barWidth = Math.max(
    Math.floor((layout.width - (stages.length - 1)) / Math.max(stages.length, 1)) - 4,
    4,
  )

  return (
    <box style={{ flexDirection: "column", flexGrow: 1 }}>
      {useCards ? (
        <box style={{ flexDirection: "row", alignItems: "flex-start", gap: 1, flexShrink: 0 }}>
          {stages.map((stage) => (
            <StageCard key={stage.name} stage={stage} barWidth={barWidth} />
          ))}
        </box>
      ) : (
        <StageList stages={stages} />
      )}

      <LogView log={log} query={query} focused={logFocused} title={title} />
    </box>
  )
}
