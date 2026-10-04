import { List } from "../components/list"
import { STATUS_META } from "../utils/format"
import type { Deployment } from "../types"

type DeployScreenProps = {
  deployments: Deployment[]
  selectedIndex: number
  focused: boolean
  onChange: (index: number) => void
  onSubmit: (index: number) => void
}

export function DeployScreen({ deployments, selectedIndex, focused, onChange, onSubmit }: DeployScreenProps) {
  return (
    <List
      items={deployments.map((d) => ({
        key: String(d.number),
        glyph: "\u{f0e7}", // nf-fa-bolt (a build)
        primary: d.name,
        status: d.status,
        statusLabel: STATUS_META[d.status].label,
        secondary: `${d.date} ${d.time} · ${d.commits} commit${d.commits === 1 ? "" : "s"}`,
      }))}
      selectedIndex={selectedIndex}
      focused={focused}
      onChange={onChange}
      onSubmit={onSubmit}
    />
  )
}
