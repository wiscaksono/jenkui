import { describe, expect, test } from "bun:test"
import { fuzzyMatch } from "./search"

describe("fuzzyMatch", () => {
  test("plain substring still matches", () => {
    expect(fuzzyMatch("polaris-web-polaris-ts", "polaris")).toBe(true)
    expect(fuzzyMatch("api-alteration-polaris", "alteration")).toBe(true)
  })

  test("empty query matches everything", () => {
    expect(fuzzyMatch("anything", "")).toBe(true)
  })

  test("resolves a single transposition typo", () => {
    // Regression target: "poalris" should still find "polaris".
    expect(fuzzyMatch("polaris-7.1-web-polaris-ts", "poalris")).toBe(true)
    expect(fuzzyMatch("polaris-scheduler", "polairs")).toBe(true)
  })

  test("resolves a loose subsequence", () => {
    expect(fuzzyMatch("polaris-scheduler", "plrs")).toBe(true)
  })

  test("does not match unrelated queries", () => {
    expect(fuzzyMatch("polaris-web", "zzzz")).toBe(false)
    expect(fuzzyMatch("polaris-web", "qqqq")).toBe(false)
  })

  test("short queries are not fuzzy-matched (avoids noise)", () => {
    // "xy" is within distance 1 of many short tokens; require length >= 3.
    expect(fuzzyMatch("builder", "xy")).toBe(false)
  })
})
