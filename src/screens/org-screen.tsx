import { List } from "../components/list"
import type { Organization } from "../types"

type OrgScreenProps = {
  organizations: Organization[]
  selectedIndex: number
  focused: boolean
  onChange: (index: number) => void
  onSubmit: (index: number) => void
}

export function OrgScreen({ organizations, selectedIndex, focused, onChange, onSubmit }: OrgScreenProps) {
  return (
    <List
      items={organizations.map((o) => ({
        key: o.name,
        glyph: "\u{f07b}", // nf-fa-folder
        primary: o.name,
        secondary: `${o.projects.length} project${o.projects.length === 1 ? "" : "s"}`,
      }))}
      selectedIndex={selectedIndex}
      focused={focused}
      onChange={onChange}
      onSubmit={onSubmit}
    />
  )
}
