import { useTheme } from "../config/theme"

type PlaceholderProps = {
  text: string
  tone?: "muted" | "error"
}

export function Placeholder({ text, tone = "muted" }: PlaceholderProps) {
  const { colors } = useTheme()
  return (
    <box
      style={{
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingX: 2,
      }}
    >
      <text fg={tone === "error" ? colors.failure : colors.faint}>{text}</text>
    </box>
  )
}
