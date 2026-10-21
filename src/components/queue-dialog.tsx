import { useRef } from "react"
import type { ScrollBoxRenderable } from "@opentui/core"
import { useTheme } from "../config/theme"
import { useLayout } from "../config/layout"
import { useScrollSelection } from "../hooks/use-scroll-selection"
import type { QueueItem } from "../api/jenkins"
import { DialogFrame } from "./dialog-frame"

type QueueDialogProps = {
  items: QueueItem[]
  selectedIndex: number
  loading: boolean
}

export function QueueDialog({ items, selectedIndex, loading }: QueueDialogProps) {
  const { colors } = useTheme()
  const layout = useLayout()
  const scrollRef = useRef<ScrollBoxRenderable>(null)
  useScrollSelection(scrollRef, selectedIndex, items.length)

  return (
    <DialogFrame
      title=" Build Queue "
      preferredWidth={64}
      preferredHeight={Math.max(8, Math.min(items.length + 6, 20))}
      scroll
      scrollRef={scrollRef}
      footer={
        <text fg={colors.faint}>
          {layout.narrow ? "enter open · x cancel" : "enter: open build · x: cancel · j/k: move · esc: close"}
        </text>
      }
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
              gap: 1,
              paddingX: 1,
              backgroundColor: current ? colors.selection : "transparent",
            }}
          >
            <text
              fg={current ? colors.selectionText : colors.muted}
              wrapMode="none"
              truncate
              style={{ flexShrink: 1, minWidth: 0 }}
            >
              {item.name}
            </text>
            <text
              fg={current ? colors.selectionText : colors.faint}
              wrapMode="none"
              truncate
              style={{ flexShrink: 0, maxWidth: layout.narrow ? 12 : 24 }}
            >
              {item.buildNumber ? `#${item.buildNumber}` : (item.why ?? "waiting")}
            </text>
          </box>
        )
      })}
    </DialogFrame>
  )
}
