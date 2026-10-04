import type { Stage } from "../types"

// Jenkins' wfapi/describe only returns stages that have already started, so a
// running build reveals them progressively. Keeping the union of everything
// seen so far prevents stages from disappearing between polls. The incoming
// data always wins because it is the freshest.
export function mergeStages(previous: Stage[], incoming: Stage[]): Stage[] {
  const byName = new Map<string, Stage>()
  for (const stage of previous) byName.set(stage.name, stage)
  for (const stage of incoming) byName.set(stage.name, stage)

  const ordered: Stage[] = []
  const seen = new Set<string>()
  for (const stage of previous) {
    if (!seen.has(stage.name)) {
      seen.add(stage.name)
      ordered.push(byName.get(stage.name)!)
    }
  }
  for (const stage of incoming) {
    if (!seen.has(stage.name)) {
      seen.add(stage.name)
      ordered.push(byName.get(stage.name)!)
    }
  }
  return ordered
}

// Seeds placeholder stages from a previous build without overwriting anything
// already known. The template arrives later than the live stage fetch, so it
// must never replace real statuses/durations with PENDING placeholders.
export function seedStages(existing: Stage[], template: Stage[]): Stage[] {
  const known = new Set(existing.map((s) => s.name))
  const missing = template.filter((s) => !known.has(s.name))
  return [...existing, ...missing]
}
