import { useTheme } from "../config/theme"
import { useLayout } from "../config/layout"
import type { Notice } from "../state/store"

export function NoticeBar({ notice }: { notice: Notice }) {
  const { colors } = useTheme()
  const layout = useLayout()
  return (
    <box style={{ flexShrink: 0, paddingX: 1, minWidth: 0 }}>
      <text
        fg={notice.tone === "error" ? colors.failure : colors.muted}
        wrapMode={layout.short ? "none" : "word"}
        truncate={layout.short}
      >
        {notice.text}
      </text>
    </box>
  )
}
