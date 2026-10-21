import { useTheme } from "../config/theme"
import { useLayout } from "../config/layout"
import { DialogFrame } from "./dialog-frame"

const SHORTCUTS: Array<[string, string]> = [
  ["j / k", "move selection down / up"],
  ["h / ←", "go back one level"],
  ["l / →", "open selected item"],
  ["enter", "open selected item"],
  ["/", "search (filters current level)"],
  ["esc", "leave search / go back"],
  ["r", "refresh data"],
  ["p", "switch Jenkins profile"],
  ["b", "build the selected job (edit parameters)"],
  ["x", "abort build / cancel queued item"],
  ["o", "open console in browser"],
  ["y", "copy build/job link"],
  ["f", "cycle status filter (list views)"],
  ["A", "toggle auto-refresh"],
  [".", "view build queue"],
  ["`", "toggle debug console"],
  ["q", "quit"],
]

export function HelpDialog() {
  const { colors } = useTheme()
  const layout = useLayout()
  const keyWidth = layout.narrow ? 7 : 10
  return (
    <DialogFrame
      title=" Keyboard Shortcuts "
      preferredWidth={52}
      preferredHeight={SHORTCUTS.length + 7}
      scroll
      autoFocusScroll
      footer={<text fg={colors.faint}>esc or ? to close</text>}
    >
      {SHORTCUTS.map(([key, desc]) => (
        <box key={key} style={{ flexDirection: "row", gap: layout.narrow ? 1 : 2 }}>
          <text fg={colors.accent} width={keyWidth} wrapMode="none" truncate>
            {key}
          </text>
          <text fg={colors.muted} wrapMode="word" style={{ flexShrink: 1, minWidth: 0 }}>
            {desc}
          </text>
        </box>
      ))}
    </DialogFrame>
  )
}
