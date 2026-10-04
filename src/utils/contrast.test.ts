import { describe, expect, test } from "bun:test"
import { readableTextColor } from "./contrast"

describe("readableTextColor", () => {
  test("dark backgrounds get white text", () => {
    expect(readableTextColor("#000000")).toBe("#FFFFFF")
    expect(readableTextColor("#1E3A5F")).toBe("#FFFFFF")
    expect(readableTextColor("#5A1E1E")).toBe("#FFFFFF")
  })

  test("light backgrounds get near-black text", () => {
    expect(readableTextColor("#FFFFFF")).toBe("#111111")
    expect(readableTextColor("#F0F0F0")).toBe("#111111")
  })

  test("accepts short hex and bare hex", () => {
    expect(readableTextColor("#fff")).toBe("#111111")
    expect(readableTextColor("000000")).toBe("#FFFFFF")
  })

  test("unparseable input falls back to white", () => {
    expect(readableTextColor("not-a-color")).toBe("#FFFFFF")
  })
})
