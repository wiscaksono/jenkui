import { useRef } from "react"
import type { ScrollBoxRenderable } from "@opentui/core"
import { useTheme } from "../config/theme"
import { useLayout } from "../config/layout"
import { useScrollSelection } from "../hooks/use-scroll-selection"
import { DialogFrame } from "./dialog-frame"

type ProfileDialogProps = {
  names: string[]
  active: string
  selectedIndex: number
}

export function ProfileDialog({ names, active, selectedIndex }: ProfileDialogProps) {
  const { colors } = useTheme()
  const layout = useLayout()
  const scrollRef = useRef<ScrollBoxRenderable>(null)
  useScrollSelection(scrollRef, selectedIndex, names.length)

  return (
    <DialogFrame
      title=" Jenkins Profile "
      preferredWidth={40}
      preferredHeight={names.length + 6}
      scroll
      scrollRef={scrollRef}
      footer={<text fg={colors.faint}>{layout.narrow ? "enter switch · esc" : "enter: switch · esc: close"}</text>}
    >
      {names.map((name, index) => {
        const current = index === selectedIndex
        const isActive = name === active
        return (
          <box
            key={name}
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
              truncate
              wrapMode="none"
              style={{ flexShrink: 1, minWidth: 0 }}
            >
              {name}
            </text>
            {isActive ? (
              <text fg={current ? colors.selectionText : colors.success} wrapMode="none">
                ● active
              </text>
            ) : null}
          </box>
        )
      })}
    </DialogFrame>
  )
}
