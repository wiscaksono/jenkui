import { colors, profileColor } from "../config/theme"
import { readableTextColor } from "../utils/contrast"

type HeaderProps = {
  title: string
  breadcrumb: string
  profile: string
  status?: string
}

export function Header({ title, breadcrumb, profile, status }: HeaderProps) {
  const bg = profileColor(profile)
  return (
    <box style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
      <ascii-font text={title} font="tiny" />
      <text fg={colors.muted}>{breadcrumb}</text>
      {status ? <text fg={colors.faint}>{`· ${status}`}</text> : null}
      <box style={{ flexGrow: 1 }} />
      <box style={{ backgroundColor: bg, paddingX: 1 }}>
        <text fg={readableTextColor(bg)}>{` ${profile} `}</text>
      </box>
    </box>
  )
}
