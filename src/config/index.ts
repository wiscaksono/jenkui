import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { SYSTEM_COLORS, THEMES, isThemeName, type SelectedTheme, type ThemeColors, type ThemeMode } from "./themes"

// User configuration lives in one directory, overridable via XDG_CONFIG_HOME:
//   ~/.config/jenkui/config.json   (Jenkins profiles, tunables)
//   ~/.config/jenkui/theme.json    (theme name, mode, color overrides)
// Missing or invalid files fall back to defaults; they never crash the app.

export const CONFIG_DIR = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "jenkui")

export type Profile = {
  url: string
  user: string
  token: string
}

export type AppConfig = {
  profiles: Record<string, Profile>
  defaultProfile: string
  pollIntervalMs: number
  autoRefreshMs: number
  pageSize: number
}

const DEFAULT_PROFILE: Profile = {
  url: "https://cicd-dev.msiglife.co.id",
  user: "",
  token: "",
}

export const DEFAULT_CONFIG: AppConfig = {
  profiles: { default: DEFAULT_PROFILE },
  defaultProfile: "default",
  pollIntervalMs: 2000,
  autoRefreshMs: 5000,
  pageSize: 100,
}

export type ThemeConfig = {
  name: SelectedTheme
  mode: ThemeMode | "system"
  overrides: Partial<ThemeColors>
  profileColors: Record<string, string>
}

export const DEFAULT_THEME: ThemeConfig = {
  name: "ajsdb",
  mode: "system",
  overrides: {},
  profileColors: {},
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    const text = readFileSync(path, "utf8")
    const parsed = JSON.parse(text) as unknown
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function toProfile(raw: Record<string, unknown>, fallback: Profile): Profile {
  return {
    url: str(raw.url) ?? fallback.url,
    user: str(raw.user) ?? fallback.user,
    token: str(raw.token) ?? fallback.token,
  }
}

// Env overrides apply to whichever profile is active at request time.
function envOverride(profile: Profile): Profile {
  return {
    url: process.env.JENKINS_URL ?? profile.url,
    user: process.env.JENKINS_USER ?? process.env.JENKINS_USERNAME ?? profile.user,
    token: process.env.JENKINS_TOKEN ?? process.env.JENKINS_API_TOKEN ?? profile.token,
  }
}

function loadProfiles(raw: Record<string, unknown>): { profiles: Record<string, Profile>; defaultProfile: string } {
  const profilesRaw = raw.profiles as Record<string, Record<string, unknown>> | undefined
  // Backward compatibility: a single top-level "jenkins" object is one profile.
  if (!profilesRaw || typeof profilesRaw !== "object") {
    const single = (raw.jenkins as Record<string, unknown> | undefined) ?? {}
    return { profiles: { default: toProfile(single, DEFAULT_PROFILE) }, defaultProfile: "default" }
  }
  const profiles: Record<string, Profile> = {}
  for (const [name, value] of Object.entries(profilesRaw)) {
    if (value && typeof value === "object") profiles[name] = toProfile(value, DEFAULT_PROFILE)
  }
  if (Object.keys(profiles).length === 0) profiles.default = DEFAULT_PROFILE
  const requested = str(raw.defaultProfile)
  const defaultProfile = requested && profiles[requested] ? requested : Object.keys(profiles)[0]!
  return { profiles, defaultProfile }
}

function loadConfig(): AppConfig {
  const raw = readJson(join(CONFIG_DIR, "config.json")) ?? {}
  const { profiles, defaultProfile } = loadProfiles(raw)
  return {
    profiles,
    defaultProfile,
    pollIntervalMs: num(raw.pollIntervalMs) ?? DEFAULT_CONFIG.pollIntervalMs,
    autoRefreshMs: num(raw.autoRefreshMs) ?? DEFAULT_CONFIG.autoRefreshMs,
    pageSize: num(raw.pageSize) ?? DEFAULT_CONFIG.pageSize,
  }
}

// Reads theme name, mode, and per-color overrides from theme.json. Colors are
// not resolved here; resolveTheme() does that once a mode is known.
function loadTheme(): ThemeConfig {
  const raw = readJson(join(CONFIG_DIR, "theme.json")) ?? {}
  const nameRaw = str(raw.theme)
  const name: SelectedTheme = nameRaw && isThemeName(nameRaw) ? nameRaw : DEFAULT_THEME.name
  const modeRaw = str(raw.mode)
  const mode: ThemeConfig["mode"] =
    modeRaw === "dark" || modeRaw === "light" || modeRaw === "system" ? modeRaw : DEFAULT_THEME.mode

  const overrides: Partial<ThemeColors> = {}
  const rawOverrides = (raw.colors as Record<string, unknown> | undefined) ?? {}
  for (const [key, value] of Object.entries(rawOverrides)) {
    const color = str(value)
    if (color) overrides[key as keyof ThemeColors] = color
  }

  const profileRaw = (raw.profile as Record<string, unknown> | undefined) ?? {}
  const profileColors: Record<string, string> = {}
  for (const [name, value] of Object.entries(profileRaw)) {
    const color = str(value)
    if (color) profileColors[name] = color
  }

  return { name, mode, overrides, profileColors }
}

/**
 * Picks the palette for a theme + detected terminal mode, then applies user
 * overrides. The `system` theme ignores the mode and uses ANSI terminal colors.
 */
export function resolveTheme(theme: ThemeConfig, detectedMode: ThemeMode): ThemeColors {
  const base =
    theme.name === "system"
      ? { ...SYSTEM_COLORS }
      : { ...THEMES[theme.name][detectedMode] }
  return { ...base, ...theme.overrides }
}

/** The mode to use, or null to wait for terminal detection. */
export function configuredMode(theme: ThemeConfig): ThemeMode | null {
  return theme.mode === "system" ? null : theme.mode
}

export const config: AppConfig = loadConfig()

// The active profile can change at runtime; getActiveProfile() resolves it fresh
// so API calls always use the current one.
let activeProfileName = config.defaultProfile

export function profileNames(): string[] {
  return Object.keys(config.profiles)
}

export function getActiveProfileName(): string {
  return activeProfileName
}

export function setActiveProfile(name: string): void {
  if (config.profiles[name]) activeProfileName = name
}

export function getActiveProfile(): Profile {
  const profile = config.profiles[activeProfileName] ?? DEFAULT_PROFILE
  return envOverride(profile)
}

export const themeConfig: ThemeConfig = loadTheme()
