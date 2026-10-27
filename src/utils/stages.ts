import type { Stage } from "../types"

// Jenkins' wfapi/describe only returns stages that have already started, so a
// running build reveals them progressively. Keeping the union of everything
// seen so far prevents stages from disappearing between polls. The incoming
// data always wins because it is the freshest.
export function mergeStages(previous: Stage[], incoming: Stage[]): Stage[] {
  const byName = new Map<string, Stage>()
  for (const stage of previous) byName.set(stage.name, stage)
  for (const stage of incoming) {
    const known = byName.get(stage.name)
    // The estimate comes from the previous build, so a live poll that knows
    // nothing about it must not drop it.
    byName.set(stage.name, known?.estimateMs ? { ...stage, estimateMs: known.estimateMs } : stage)
  }

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
  const estimates = new Map<string, number>()
  for (const stage of template) {
    if (stage.estimateMs) estimates.set(stage.name, stage.estimateMs)
  }
  const known = new Set(existing.map((stage) => stage.name))
  // The template may arrive after the first poll, so borrow its estimates for
  // stages that are already live instead of only appending the missing ones.
  const merged = existing.map((stage) => {
    const estimate = estimates.get(stage.name)
    return stage.estimateMs || !estimate ? stage : { ...stage, estimateMs: estimate }
  })
  const missing = template.filter((stage) => !known.has(stage.name))
  return [...merged, ...missing]
}
