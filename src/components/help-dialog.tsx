import { useTheme } from "../config/theme"

const SHORTCUTS: Array<[string, string]> = [
  ["j / k", "move selection down / up"],
  ["h / ←", "go back one level"],
  ["l / →", "open selected item"],
  ["enter", "open selected item"],
  ["/", "search (filters current level)"],
  ["esc", "leave search / go back"],
  ["r", "refresh data"],
  ["p", "switch Jenkins profile"],
  ["b", "build the selected job"],
  ["x", "abort a running build"],
  ["o", "open console in browser"],
  ["y", "copy build/job link"],
  ["f", "cycle status filter"],
  ["A", "toggle auto-refresh"],
  [".", "view build queue"],
  ["`", "toggle debug console"],
  ["q", "quit"],
]

export function HelpDialog() {
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
        title=" Keyboard Shortcuts "
        titleAlignment="center"
        border
        borderStyle="rounded"
        borderColor={colors.accent}
        style={{
          flexDirection: "column",
          width: 52,
          paddingX: 2,
          paddingY: 1,
          backgroundColor: colors.surface,
        }}
      >
        {SHORTCUTS.map(([key, desc]) => (
          <box key={key} style={{ flexDirection: "row", gap: 2 }}>
            <text fg={colors.accent} width={10}>
              {key}
            </text>
            <text fg={colors.muted}>{desc}</text>
          </box>
        ))}
        <box style={{ marginTop: 1 }}>
          <text fg={colors.faint}>esc or ? to close</text>
        </box>
      </box>
    </box>
  )
}
