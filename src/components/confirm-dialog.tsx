import { useTheme } from "../config/theme"
import { useLayout } from "../config/layout"
import type { ConfirmAction } from "../state/store"
import { DialogFrame } from "./dialog-frame"

type ConfirmDialogProps = {
  action: ConfirmAction
  busy: boolean
}

const TITLES: Record<ConfirmAction["kind"], string> = {
  build: " Start a new build ",
  stop: " Confirm Abort ",
  cancelQueue: " Cancel Queued Build ",
}

export function ConfirmDialog({ action, busy }: ConfirmDialogProps) {
  const { colors } = useTheme()
  const layout = useLayout()
  const danger = action.kind !== "build"
  const params =
    action.kind === "build" && action.params && action.params.length > 0
      ? layout.narrow
        ? `${action.params.length} parameters`
        : action.params.map((param) => `${param.name}=${param.secret ? "(hidden)" : param.value}`).join(" · ")
      : null

  return (
    <DialogFrame
      title={TITLES[action.kind]}
      preferredWidth={54}
      preferredHeight={12}
      scroll
      autoFocusScroll
      borderColor={danger ? colors.failure : colors.accent}
      footer={
        <text fg={busy ? colors.running : colors.faint}>
          {busy ? "working…" : layout.narrow ? "enter: yes · esc: no" : "enter/y: confirm · esc/n: cancel"}
        </text>
      }
    >
      <text fg={colors.muted} wrapMode="word">
        {action.label}
      </text>
      {params ? (
        <text fg={colors.faint} wrapMode={layout.narrow ? "none" : "word"} truncate={layout.narrow}>
          {`params: ${params}`}
        </text>
      ) : null}
      <text fg={colors.faint} wrapMode="none" truncate>
        {`profile: ${action.profile}`}
      </text>
      <text fg={colors.faint} wrapMode="none" truncate>
        {action.url}
      </text>
    </DialogFrame>
  )
}
