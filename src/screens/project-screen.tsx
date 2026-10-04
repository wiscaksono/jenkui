import { List } from "../components/list"
import { STATUS_META } from "../utils/format"
import type { Project } from "../types"

type ProjectScreenProps = {
  projects: Project[]
  selectedIndex: number
  focused: boolean
  onChange: (index: number) => void
  onSubmit: (index: number) => void
}

export function ProjectScreen({ projects, selectedIndex, focused, onChange, onSubmit }: ProjectScreenProps) {
  return (
    <List
      items={projects.map((p) => ({
        key: p.path, // names repeat across folders; the path is unique
        glyph: p.folder ? "\u{f07b}" : "\u{f0ad}", // folder for foldered jobs, cube otherwise
        primary: p.name,
        status: p.status,
        statusLabel: STATUS_META[p.status].label,
        secondary: p.folder,
      }))}
      selectedIndex={selectedIndex}
      focused={focused}
      onChange={onChange}
      onSubmit={onSubmit}
    />
  )
}
