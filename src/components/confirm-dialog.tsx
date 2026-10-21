import { useTheme } from "../config/theme"
import type { ConfirmAction } from "../state/store"

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
  const danger = action.kind !== "build"
  return (
    <box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.overlay,
        opacity: 0.85,
      }}
    >
      <box
        title={TITLES[action.kind]}
        titleAlignment="center"
        border
        borderStyle="rounded"
        borderColor={danger ? colors.failure : colors.accent}
        style={{ flexDirection: "column", width: 54, paddingX: 2, paddingY: 1, backgroundColor: colors.surface }}
      >
        <text fg={colors.muted}>{action.label}</text>
        {action.kind === "build" && action.params && action.params.length > 0 ? (
          <text fg={colors.faint} wrapMode="none">
            {`params: ${action.params
              .map((param) => `${param.name}=${param.secret ? "(hidden)" : param.value}`)
              .join(" · ")}`}
          </text>
        ) : null}
        <text fg={colors.faint}>{`profile: ${action.profile}`}</text>
        <text fg={colors.faint} wrapMode="none">
          {action.url}
        </text>
        <box style={{ marginTop: 1 }}>
          <text fg={busy ? colors.running : colors.faint}>
            {busy ? "working…" : "enter/y: confirm · esc/n: cancel"}
          </text>
        </box>
      </box>
    </box>
  )
}
