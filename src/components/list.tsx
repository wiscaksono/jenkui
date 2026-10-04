import { useEffect, useRef } from "react"
import type { ScrollBoxRenderable } from "@opentui/core"
import { colors } from "../config/theme"
import { statusColor } from "../config/theme"
import { useSpinner } from "../hooks/use-spinner"
import { STATUS_META } from "../utils/format"
import type { StageStatus } from "../types"

export type ListItem = {
  key: string
  primary: string
  glyph?: string
  status?: StageStatus
  statusLabel?: string
  secondary?: string
}

type ListProps = {
  items: ListItem[]
  selectedIndex: number
  focused: boolean
  onChange: (index: number) => void
  onSubmit: (index: number) => void
}

// A controlled list: selectedIndex is owned by the app, not by the component,
// so filtering and selection never drift apart. Keyboard is handled globally
// (see state/keymap.ts), which keeps a single source of truth for key actions.
export function List({ items, selectedIndex, focused, onChange, onSubmit }: ListProps) {
  const spinner = useSpinner(items.some((i) => i.status === "RUNNING"))
  const scrollRef = useRef<ScrollBoxRenderable>(null)

  // Keep the highlighted row in view using absolute scroll offsets. Each row is
  // one line tall, so the index maps directly to a scroll position; this avoids
  // the delta accumulation that scrollChildIntoView suffers under fast input.
  // A deferred tick gives the terminal a chance to lay out the viewport first.
  useEffect(() => {
    if (!focused) return
    const apply = () => {
      const box = scrollRef.current
      if (!box) return
      const height = box.viewport.height
      if (!height) return
      if (selectedIndex < box.scrollTop) box.scrollTop = selectedIndex
      else if (selectedIndex >= box.scrollTop + height) box.scrollTop = selectedIndex - height + 1
    }
    apply()
    const timer = setTimeout(apply, 16)
    return () => clearTimeout(timer)
  }, [focused, selectedIndex, items.length])

  return (
    <scrollbox ref={scrollRef} style={{ flexGrow: 1 }}>
      {items.map((item, index) => {
        const current = index === selectedIndex
        return (
          <box
            key={item.key}
            id={`list-${index}`}
            style={{
              flexDirection: "row",
              gap: 1,
              paddingX: 1,
              backgroundColor: current ? (focused ? "#2A2A44" : "#1E1E30") : "transparent",
            }}
            onMouseDown={() => onChange(index)}
            onMouseUp={() => onSubmit(index)}
          >
            <text fg={current ? colors.accent : colors.muted} wrapMode="none">
              {item.status === "RUNNING" ? `${spinner} ${item.primary}` : item.primary}
            </text>
            {item.statusLabel && item.status ? (
              <text fg={statusColor[item.status]}>{`${STATUS_META[item.status].glyph} ${item.statusLabel}`}</text>
            ) : null}
            {item.secondary ? <text fg={colors.faint}>{item.secondary}</text> : null}
          </box>
        )
      })}
    </scrollbox>
  )
}
