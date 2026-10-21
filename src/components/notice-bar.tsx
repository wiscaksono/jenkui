import { useTheme } from "../config/theme"
import type { Notice } from "../state/store"

export function NoticeBar({ notice }: { notice: Notice }) {
  const { colors } = useTheme()
  return (
    <box style={{ flexShrink: 0, paddingX: 1 }}>
      <text fg={notice.tone === "error" ? colors.failure : colors.muted}>{notice.text}</text>
    </box>
  )
}
