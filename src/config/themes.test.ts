import { describe, expect, test } from "bun:test"
import { RGBA } from "@opentui/core"
import { THEMES, THEME_NAMES, SYSTEM_COLORS } from "./themes"
import { DEFAULT_THEME, resolveTheme, type ThemeConfig } from "./index"

const HEX = /^#[0-9A-Fa-f]{6}$/

describe("themes", () => {
  test("every preset defines a dark and light palette of hex colors", () => {
    for (const name of THEME_NAMES) {
      for (const mode of ["dark", "light"] as const) {
        const palette = THEMES[name][mode]
        for (const value of Object.values(palette)) expect(value).toMatch(HEX)
      }
    }
  })

  test("includes the built-in default and known presets", () => {
    expect(THEME_NAMES).toContain("default")
    expect(THEME_NAMES).toContain("tokyonight")
    expect(THEME_NAMES).toContain("dracula")
  })

  test("the app defaults to the system theme", () => {
    expect(DEFAULT_THEME.name).toBe("system")
  })

  test("brand presets keep their signature accent", () => {
    expect(THEMES.tokyonight.dark.accent).toBe("#7AA2F7")
    expect(THEMES.gruvbox.dark.accent).toBe("#FABD2F")
  })

  test("system theme uses terminal defaults", () => {
    expect((SYSTEM_COLORS.dark.foreground as { intent: string }).intent).toBe("default")
    expect((SYSTEM_COLORS.light.background as { intent: string }).intent).toBe("default")
    expect((SYSTEM_COLORS.dark.accent as { intent: string }).intent).toBe("indexed")
  })

  test("system theme tunes accent/status per mode so it stays readable", () => {
    // Light backgrounds need the normal (not bright) ANSI slots.
    expect((SYSTEM_COLORS.dark.accent as RGBA).slot).toBe(11)
    expect((SYSTEM_COLORS.light.accent as RGBA).slot).toBe(3)
    expect((SYSTEM_COLORS.dark.muted as RGBA).slot).toBe(7)
    expect((SYSTEM_COLORS.light.muted as RGBA).slot).toBe(8)
  })
})

describe("resolveTheme", () => {
  const base: ThemeConfig = { name: "tokyonight", mode: "dark", overrides: {}, profileColors: {} }

  test("picks the palette for the detected mode", () => {
    expect(resolveTheme(base, "dark").accent).toBe(THEMES.tokyonight.dark.accent)
    expect(resolveTheme(base, "light").accent).toBe(THEMES.tokyonight.light.accent)
  })

  test("applies user overrides on top", () => {
    const themed = { ...base, overrides: { accent: "#FF00FF" } }
    expect(resolveTheme(themed, "dark").accent).toBe("#FF00FF")
    // Untouched tokens still come from the preset.
    expect(resolveTheme(themed, "dark").success).toBe(THEMES.tokyonight.dark.success)
  })

  test("system theme follows the detected mode for accent", () => {
    const system: ThemeConfig = { ...base, name: "system" }
    expect(resolveTheme(system, "dark").accent).toBe(SYSTEM_COLORS.dark.accent)
    expect(resolveTheme(system, "light").accent).toBe(SYSTEM_COLORS.light.accent)
    // Foreground still defers to the terminal in both modes.
    expect(resolveTheme(system, "light").foreground).toBe(SYSTEM_COLORS.light.foreground)
  })
})
