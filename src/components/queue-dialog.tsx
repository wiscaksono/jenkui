import { useTheme } from "../config/theme"
import type { QueueItem } from "../api/jenkins"

type QueueDialogProps = {
  items: QueueItem[]
  selectedIndex: number
  loading: boolean
}

export function QueueDialog({ items, selectedIndex, loading }: QueueDialogProps) {
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
        title=" Build Queue "
        titleAlignment="center"
        border
        borderStyle="rounded"
        borderColor={colors.accent}
        style={{ flexDirection: "column", width: 64, paddingX: 2, paddingY: 1, backgroundColor: colors.surface }}
      >
        {loading && items.length === 0 ? <text fg={colors.faint}>Loading queue…</text> : null}
        {!loading && items.length === 0 ? <text fg={colors.faint}>Queue is empty</text> : null}
        {items.map((item, index) => {
          const current = index === selectedIndex
          return (
            <box
              key={item.id}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                gap: 2,
                paddingX: 1,
                backgroundColor: current ? colors.selection : "transparent",
              }}
            >
              <text fg={current ? colors.selectionText : colors.muted} wrapMode="none">
                {item.name}
              </text>
              <text fg={current ? colors.selectionText : colors.faint} wrapMode="none">
                {item.buildNumber ? `#${item.buildNumber}` : (item.why ?? "waiting")}
              </text>
            </box>
          )
        })}
        <box style={{ marginTop: 1 }}>
          <text fg={colors.faint}>j/k: move · esc: close</text>
        </box>
      </box>
    </box>
  )
}
