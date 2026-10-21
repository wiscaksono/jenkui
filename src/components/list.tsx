import { useRef } from "react"
import type { ScrollBoxRenderable } from "@opentui/core"
import { useTheme } from "../config/theme"
import { useLayout } from "../config/layout"
import { useScrollSelection } from "../hooks/use-scroll-selection"
import { useSpinner } from "../hooks/use-spinner"
import { STATUS_META } from "../utils/format"
import type { StageStatus } from "../types"
import type { ThemeColor } from "../config/themes"

export type ListItem = {
  key: string
  primary: string
  glyph?: string
  status?: StageStatus
  statusLabel?: string
  secondary?: string
  /** Folder context is worth keeping longer than dates/commit counts. */
  secondaryPriority?: "normal" | "important"
}

type ListProps = {
  items: ListItem[]
  selectedIndex: number
  focused: boolean
  onChange: (index: number) => void
  onSubmit: (index: number) => void
}

/** The animation lives in this leaf, so a running build does not re-render the whole list. */
function RunningGlyph({ color }: { color: ThemeColor }) {
  const spinner = useSpinner(true)
  return <text fg={color}>{spinner}</text>
}

// A controlled list: selectedIndex is owned by the app, not by the component,
// so filtering and selection never drift apart. Keyboard is handled globally
// (see state/keymap.ts), which keeps a single source of truth for key actions.
export function List({ items, selectedIndex, focused, onChange, onSubmit }: ListProps) {
  const { colors, statusColor } = useTheme()
  const layout = useLayout()
  const scrollRef = useRef<ScrollBoxRenderable>(null)
  useScrollSelection(scrollRef, selectedIndex, items.length, focused)

  return (
    <scrollbox
      ref={scrollRef}
      style={{ flexGrow: 1 }}
      // OpenTUI scrollbars default to a fixed dark track/thumb that clashes with
      // light terminals; derive both from the active palette instead.
      scrollbarOptions={{
        trackOptions: { backgroundColor: colors.selectionDim, foregroundColor: colors.faint },
      }}
    >
      {items.map((item, index) => {
        const current = index === selectedIndex
        const onSelected = current && focused
        const showSecondary =
          Boolean(item.secondary) &&
          (layout.showSecondary || (item.secondaryPriority === "important" && !layout.narrow))
        const showStatusLabel = layout.width >= 50
        return (
          <box
            key={item.key}
            id={`list-${index}`}
            style={{
              flexDirection: "row",
              gap: 1,
              paddingX: 1,
              backgroundColor: onSelected ? colors.selection : "transparent",
            }}
            onMouseDown={() => onChange(index)}
            onMouseUp={() => onSubmit(index)}
          >
            {item.status === "RUNNING" ? (
              <RunningGlyph color={onSelected ? colors.selectionText : statusColor.RUNNING} />
            ) : null}
            <text
              fg={onSelected ? colors.selectionText : colors.muted}
              wrapMode="none"
              truncate
              style={{ flexShrink: 1, minWidth: 0 }}
            >
              {item.primary}
            </text>
            {item.statusLabel && item.status ? (
              <text fg={onSelected ? colors.selectionText : statusColor[item.status]} wrapMode="none">
                {showStatusLabel
                  ? `${STATUS_META[item.status].glyph} ${item.statusLabel}`
                  : STATUS_META[item.status].glyph}
              </text>
            ) : null}
            {showSecondary ? (
              <text
                fg={onSelected ? colors.selectionText : colors.faint}
                wrapMode="none"
                truncate
                style={{ flexShrink: 1, minWidth: 0 }}
              >
                {item.secondary}
              </text>
            ) : null}
          </box>
        )
      })}
    </scrollbox>
  )
}
