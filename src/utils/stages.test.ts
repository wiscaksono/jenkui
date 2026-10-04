import { describe, expect, test } from "bun:test"
import { mergeStages, seedStages } from "./stages"
import type { Stage } from "../types"

const stage = (name: string, durationMs: number, status: Stage["status"] = "SUCCESS"): Stage => ({
  name,
  durationMs,
  status,
  startedAt: "00:00:00",
})

describe("mergeStages", () => {
  test("keeps stages revealed in earlier polls", () => {
    // Poll 1 revealed only two stages, poll 2 revealed two more.
    const first = [stage("Checkout", 1000)]
    const second = [stage("Checkout", 1500), stage("build", 300, "RUNNING")]
    const merged = mergeStages(first, second)
    expect(merged.map((s) => s.name)).toEqual(["Checkout", "build"])
  })

  test("updates duration and status of an existing stage", () => {
    const merged = mergeStages([stage("Checkout", 1000)], [stage("Checkout", 2500, "RUNNING")])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.durationMs).toBe(2500)
    expect(merged[0]?.status).toBe("RUNNING")
  })

  test("does not resurrect a stage missing from the latest poll", () => {
    const merged = mergeStages([stage("Checkout", 1000), stage("build", 300)], [stage("build", 300)])
    expect(merged.map((s) => s.name)).toEqual(["Checkout", "build"])
  })

  test("preserves first-seen order", () => {
    const merged = mergeStages([stage("A", 1)], [stage("B", 1), stage("C", 1)])
    expect(merged.map((s) => s.name)).toEqual(["A", "B", "C"])
  })
})

describe("seedStages", () => {
  test("appends template stages that are not already present", () => {
    const existing = [stage("A", 100), stage("B", 200)]
    const template = [stage("A", 0, "PENDING"), stage("B", 0, "PENDING"), stage("C", 0, "PENDING")]
    const seeded = seedStages(existing, template)
    expect(seeded.map((s) => s.name)).toEqual(["A", "B", "C"])
  })

  test("never overwrites live status or duration", () => {
    // Regression: the template arrives after live stages and used to clobber
    // real success/failure with pending placeholders.
    const existing = [stage("build", 5000, "FAILURE")]
    const template = [stage("build", 0, "PENDING")]
    const seeded = seedStages(existing, template)
    expect(seeded).toHaveLength(1)
    expect(seeded[0]?.status).toBe("FAILURE")
    expect(seeded[0]?.durationMs).toBe(5000)
  })
})
