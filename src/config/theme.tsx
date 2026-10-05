import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import { CliRenderEvents, RGBA } from "@opentui/core"
import { useRenderer } from "@opentui/react"
import { useEffect } from "react"
import { configuredMode, resolveTheme, themeConfig } from "./index"
import { systemColors } from "./themes"
import type { ThemeColor, ThemeColors, ThemeMode } from "./themes"
import type { StageStatus } from "../types"

export type Theme = {
  colors: ThemeColors
  statusColor: Record<StageStatus, ThemeColor>
  profileColor: (name: string) => string
}

// Concrete colors reported by the terminal via OSC queries, or null when the
// terminal does not answer (e.g. tmux, plain TERM). Only the `system` theme uses
// these; named themes keep their hand-picked palette.
export type TerminalPalette = {
  foreground: string
  background: string
  palette: string[]
  highlightBackground: string | null
  highlightForeground: string | null
}

// Asks the terminal for its real colors (fg/bg, the 16 ANSI slots, and its own
// selection colors). Guessing with intent colors is unreliable because OpenTUI
// falls back to its own black/white when the terminal does not resolve them, so
// the `system` theme prefers these answers and only falls back when missing.
function useTerminalPalette(enabled: boolean, mode: ThemeMode): TerminalPalette | null {
  const renderer = useRenderer()
  const [palette, setPalette] = useState<TerminalPalette | null>(null)

  useEffect(() => {
    if (!enabled) {
      setPalette(null)
      return
    }
    let active = true
    void renderer
      .getPalette({ timeout: 1000 })
      .then((result) => {
        if (!active || !result.defaultForeground || !result.defaultBackground) return
        setPalette({
          foreground: result.defaultForeground,
          background: result.defaultBackground,
          palette: result.palette.slice(0, 16).map((color) => color ?? ""),
          highlightBackground: result.highlightBackground,
          highlightForeground: result.highlightForeground,
        })
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [renderer, enabled, mode])

  return palette
}

// Detects the terminal mode through OpenTUI (Mode 2031 + fallback), then keeps
// the palette in sync with live mode changes when the config says "system".
function useThemeValue(): ThemeColors {
  const renderer = useRenderer()
  const fixed = configuredMode(themeConfig)
  const [mode, setMode] = useState<ThemeMode>(fixed ?? "dark")
  const terminalPalette = useTerminalPalette(themeConfig.name === "system", mode)

  useEffect(() => {
    if (fixed) {
      setMode(fixed)
      return
    }
    let active = true
    // themeMode may already be known; waitForThemeMode resolves current or next.
    void renderer.waitForThemeMode(2000).then((detected) => {
      if (active && detected) setMode(detected)
    })
    const onChange = (detected: ThemeMode) => setMode(detected)
    renderer.on(CliRenderEvents.THEME_MODE, onChange)
    return () => {
      active = false
      renderer.off(CliRenderEvents.THEME_MODE, onChange)
    }
  }, [renderer, fixed])

  return useMemo(() => {
    // With real terminal colors, build the whole system palette from them so the
    // background and foreground are the terminal's own; otherwise fall back to
    // intent colors that follow the terminal when it resolves them.
    const base =
      terminalPalette && themeConfig.name === "system"
        ? systemColors(mode, terminalPalette)
        : resolveTheme(themeConfig, mode)
    if (terminalPalette?.highlightBackground) {
      base.selection = RGBA.fromHex(terminalPalette.highlightBackground)
      if (terminalPalette.highlightForeground) {
        base.selectionText = RGBA.fromHex(terminalPalette.highlightForeground)
      }
    }
    return base
  }, [mode, terminalPalette])
}

const ThemeContext = createContext<Theme | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const renderer = useRenderer()
  const colors = useThemeValue()

  // Keep the renderer's own fill in step with the palette background.
  useEffect(() => {
    renderer.setBackgroundColor(colors.background)
  }, [renderer, colors.background])

  const value = useMemo<Theme>(() => {
    const statusColor: Record<StageStatus, ThemeColor> = {
      SUCCESS: colors.success,
      FAILURE: colors.failure,
      RUNNING: colors.running,
      SKIPPED: colors.skipped,
      PENDING: colors.pending,
    }
    return {
      colors,
      statusColor,
      // Profile badge colors come from config as hex strings; fall back to a
      // fixed gray when the profile has none.
      profileColor: (name: string) => themeConfig.profileColors[name] ?? "#888888",
    }
  }, [colors])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext)
  if (!theme) throw new Error("useTheme must be used inside <ThemeProvider>")
  return theme
}
