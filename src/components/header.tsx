import { useTheme } from "../config/theme"
import { useLayout } from "../config/layout"
import { readableTextColor } from "../utils/contrast"

type HeaderProps = {
  breadcrumb: string
  profile: string
  status?: string
}

export function Header({ breadcrumb, profile, status }: HeaderProps) {
  const { colors, profileColor } = useTheme()
  const layout = useLayout()
  const bg = profileColor(profile)
  return (
    <box
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: layout.compact ? 1 : 2,
        flexShrink: 0,
        minWidth: 0,
      }}
    >
      <text
        fg={colors.foreground}
        truncate
        wrapMode="none"
        style={{ flexShrink: 1, minWidth: 0 }}
      >
        {breadcrumb}
      </text>
      {status && layout.showStatus ? (
        <text fg={colors.faint} truncate wrapMode="none">
          {`· ${status}`}
        </text>
      ) : null}
      <box style={{ flexGrow: 1, minWidth: 0 }} />
      <box
        style={{
          backgroundColor: bg,
          paddingX: 1,
          flexShrink: 0,
          maxWidth: layout.narrow ? 14 : 22,
        }}
      >
        <text fg={readableTextColor(bg)} truncate wrapMode="none">
          {` ${profile} `}
        </text>
      </box>
    </box>
  )
}
