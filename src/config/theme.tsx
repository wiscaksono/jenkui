import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import { CliRenderEvents } from "@opentui/core"
import { useRenderer } from "@opentui/react"
import { useEffect } from "react"
import { configuredMode, resolveTheme, themeConfig } from "./index"
import type { ThemeColor, ThemeColors, ThemeMode } from "./themes"
import type { StageStatus } from "../types"

export type Theme = {
  colors: ThemeColors
  statusColor: Record<StageStatus, ThemeColor>
  profileColor: (name: string) => string
}

// Detects the terminal mode through OpenTUI (Mode 2031 + fallback), then keeps
// the palette in sync with live mode changes when the config says "system".
function useThemeValue(): ThemeColors {
  const renderer = useRenderer()
  const fixed = configuredMode(themeConfig)
  const [mode, setMode] = useState<ThemeMode>(fixed ?? "dark")

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

  return useMemo(() => resolveTheme(themeConfig, mode), [mode])
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
