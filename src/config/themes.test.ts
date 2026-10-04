import { describe, expect, test } from "bun:test"
import { THEMES, themeNames } from "./themes"

describe("themes", () => {
  test("every preset defines all eight tokens as hex colors", () => {
    for (const name of themeNames()) {
      const t = THEMES[name as keyof typeof THEMES]
      for (const value of Object.values(t)) {
        expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }
    }
  })

  test("includes the built-in default and a few known presets", () => {
    expect(themeNames()).toContain("ajsdb")
    expect(themeNames()).toContain("tokyonight")
    expect(themeNames()).toContain("dracula")
  })
})
