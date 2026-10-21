import { describe, expect, test } from "bun:test"
import { dialogHeight, dialogWidth, layoutFor } from "./layout"

describe("layoutFor", () => {
  test("wide terminals fit stage cards", () => {
    const layout = layoutFor(120, 40)
    expect(layout.compact).toBe(false)
    expect(layout.narrow).toBe(false)
    expect(layout.short).toBe(false)
    expect(layout.tooSmall).toBe(false)
    expect(layout.stageCards(5)).toBe(true)
  })

  test("80x24 is compact but still shows status and secondary columns", () => {
    const layout = layoutFor(80, 24)
    expect(layout.compact).toBe(false)
    expect(layout.narrow).toBe(false)
    expect(layout.showStatus).toBe(true)
    expect(layout.showSecondary).toBe(true)
    expect(layout.stageCards(3)).toBe(false)
  })

  test("60x20 hides secondary columns and uses the narrow header", () => {
    const layout = layoutFor(60, 20)
    expect(layout.narrow).toBe(true)
    expect(layout.compact).toBe(true)
    expect(layout.short).toBe(true)
    expect(layout.showSecondary).toBe(false)
    expect(layout.showStatus).toBe(false)
  })

  test("40x12 is still usable but no longer wide enough for cards", () => {
    const layout = layoutFor(40, 12)
    expect(layout.narrow).toBe(true)
    expect(layout.tooSmall).toBe(false)
    expect(layout.stageCards(2)).toBe(false)
  })

  test("very small terminals are flagged instead of rendering a broken layout", () => {
    expect(layoutFor(29, 20).tooSmall).toBe(true)
    expect(layoutFor(80, 9).tooSmall).toBe(true)
    expect(layoutFor(0, 0).tooSmall).toBe(false)
  })

  test("many stages fall back to the compact list even on a wide terminal", () => {
    expect(layoutFor(120, 40).stageCards(5)).toBe(true)
    expect(layoutFor(120, 40).stageCards(6)).toBe(false)
  })
})

describe("dialog sizing", () => {
  test("clamps dialogs to the terminal with a margin", () => {
    expect(dialogWidth(72, 120)).toBe(72)
    expect(dialogWidth(72, 60)).toBe(56)
    expect(dialogWidth(72, 40)).toBe(36)
    expect(dialogHeight(22, 40)).toBe(22)
    expect(dialogHeight(22, 20)).toBe(18)
    expect(dialogHeight(22, 8)).toBe(6)
  })
})
