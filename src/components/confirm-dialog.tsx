import { useTheme } from "../config/theme"
import type { ConfirmAction } from "../state/store"

type ConfirmDialogProps = {
  action: ConfirmAction
  busy: boolean
}

export function ConfirmDialog({ action, busy }: ConfirmDialogProps) {
  const { colors } = useTheme()
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
        title={action.kind === "build" ? " Start a new build " : " Confirm Abort "}
        titleAlignment="center"
        border
        borderStyle="rounded"
        borderColor={action.kind === "build" ? colors.accent : colors.failure}
        style={{ flexDirection: "column", width: 54, paddingX: 2, paddingY: 1, backgroundColor: colors.surface }}
      >
        <text fg={colors.muted}>{action.label}</text>
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
