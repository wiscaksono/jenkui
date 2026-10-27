import { describe, expect, test } from "bun:test"
import { progressBar, stageRatio } from "./progress"

describe("stageRatio", () => {
  test("compares elapsed time against the previous build", () => {
    expect(stageRatio(5_000, 10_000)).toBe(0.5)
    expect(stageRatio(2_500, 10_000)).toBe(0.25)
  })

  test("caps a running stage just below 100%", () => {
    expect(stageRatio(20_000, 10_000)).toBe(0.99)
  })

  test("returns null without a usable estimate", () => {
    expect(stageRatio(5_000, undefined)).toBeNull()
    expect(stageRatio(5_000, 0)).toBeNull()
    expect(stageRatio(5_000, -1)).toBeNull()
  })

  test("never reports negative progress", () => {
    expect(stageRatio(-500, 10_000)).toBe(0)
  })
})

describe("progressBar", () => {
  test("splits the bar into solid, head, and braille runs", () => {
    expect(progressBar(0.5, 8)).toEqual({ fill: "████", head: "⣿", rail: "⣿⣿⣿" })
    expect(progressBar(0.25, 8)).toEqual({ fill: "██", head: "⣿", rail: "⣿⣿⣿⣿⣿" })
  })

  test("fills the whole row when the stage is done", () => {
    expect(progressBar(1, 4)).toEqual({ fill: "████", head: "", rail: "" })
  })

  test("keeps the head cell while the stage is still running", () => {
    // 0.99 of 4 cells would round to a full row.
    expect(progressBar(0.99, 4)).toEqual({ fill: "███", head: "⣿", rail: "" })
  })

  test("lights one cell as soon as progress starts", () => {
    expect(progressBar(0.01, 20)).toEqual({ fill: "█", head: "⣿", rail: "⣿".repeat(18) })
    expect(progressBar(0, 4)).toEqual({ fill: "", head: "⣿", rail: "⣿⣿⣿" })
  })

  test("pulses the head without touching the rest of the track", () => {
    expect(progressBar(0.5, 8, 1)).toEqual({ fill: "████", head: "⣷", rail: "⣿⣿⣿" })
    expect(progressBar(0.5, 8, 8)).toEqual(progressBar(0.5, 8, 0))
    expect(progressBar(0.5, 8, 3)).toEqual({ fill: "████", head: "⣟", rail: "⣿⣿⣿" })
  })

  test("always emits exactly width cells", () => {
    for (const ratio of [0, 0.1, 0.5, 0.99, 1]) {
      const bar = progressBar(ratio, 9, 4)
      expect([...bar.fill, ...bar.head, ...bar.rail]).toHaveLength(9)
    }
  })

  test("uses the full braille wave when the length is unknown", () => {
    const first = progressBar(null, 4, 0)
    expect(first).toEqual({ fill: "⣿⣷⣯⣟", head: "", rail: "" })
    expect(progressBar(null, 4, 1).fill).toBe("⣷⣯⣟⡿")
    expect(progressBar(null, 4, 8).fill).toBe(first.fill)
    expect(progressBar(null, 4, 9).fill).toHaveLength(4)
  })

  test("is empty at zero width", () => {
    expect(progressBar(0.5, 0)).toEqual({ fill: "", head: "", rail: "" })
  })
})
