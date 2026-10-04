import { describe, expect, test } from "bun:test"
import { spinnerFrame } from "./spinner"

describe("spinnerFrame", () => {
  test("cycles through frames and wraps", () => {
    expect(spinnerFrame(0)).toBe("⠋")
    expect(spinnerFrame(1)).toBe("⠙")
    expect(spinnerFrame(10)).toBe(spinnerFrame(0))
  })
})
