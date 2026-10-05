import { RGBA } from "@opentui/core"

// A color is either a hex/named string or an RGBA carrying terminal intent
// (ANSI index or terminal default). The `system` theme relies on the latter.
export type ThemeColor = string | RGBA

export type ThemeColors = {
  foreground: ThemeColor
  background: ThemeColor
  accent: ThemeColor
  muted: ThemeColor
  faint: ThemeColor
  success: ThemeColor
  failure: ThemeColor
  running: ThemeColor
  skipped: ThemeColor
  pending: ThemeColor
  /** Background of the highlighted row when the list has focus. */
  selection: ThemeColor
  /** Dimmer variant used when the list is unfocused. */
  selectionDim: ThemeColor
  /** Modal backdrop fill. */
  overlay: ThemeColor
  /** Dialog/panel surface fill. */
  surface: ThemeColor
}

export type ThemeMode = "dark" | "light"

// A named theme provides a palette for each mode. The `system` theme is special:
// it has no dark/light variants and defers to the terminal's ANSI colors.
export type Theme = {
  dark: ThemeColors
  light: ThemeColors
}

export const THEME_NAMES = [
  "ajsdb",
  "tokyonight",
  "catppuccin",
  "dracula",
  "gruvbox",
  "nord",
  "one-dark",
  "rosepine",
] as const

export type ThemeName = (typeof THEME_NAMES)[number]

export type SelectedTheme = ThemeName | "system"

export const THEMES: Record<ThemeName, Theme> = {
  ajsdb: {
    dark: {
      foreground: "#E6E6E6",
      background: "#101014",
      accent: "#FFFF00",
      muted: "#888888",
      faint: "#666666",
      success: "#5FD75F",
      failure: "#FF5F5F",
      running: "#FFD75F",
      skipped: "#555555",
      pending: "#7A8899",
      selection: "#2A2A44",
      selectionDim: "#1E1E30",
      overlay: "#000000",
      surface: "#111122",
    },
    light: {
      foreground: "#1A1A1A",
      background: "#F4F4F0",
      accent: "#8A6D00",
      muted: "#5C5C5C",
      faint: "#8A8A8A",
      success: "#1F8A3B",
      failure: "#C0392B",
      running: "#B8860B",
      skipped: "#B0B0B0",
      pending: "#7C8A99",
      selection: "#D5D8EE",
      selectionDim: "#E7E8F2",
      overlay: "#FFFFFF",
      surface: "#FFFFFF",
    },
  },
  tokyonight: {
    dark: {
      foreground: "#C0CAF5",
      background: "#1A1B26",
      accent: "#7AA2F7",
      muted: "#9AA5CE",
      faint: "#565F89",
      success: "#9ECE6A",
      failure: "#F7768E",
      running: "#E0AF68",
      skipped: "#414868",
      pending: "#6D7A9C",
      selection: "#2A2A44",
      selectionDim: "#1E1E30",
      overlay: "#000000",
      surface: "#111122",
    },
    light: {
      foreground: "#3760BF",
      background: "#E1E2E7",
      accent: "#2E7DE9",
      muted: "#6172B0",
      faint: "#8990B3",
      success: "#587539",
      failure: "#F52A65",
      running: "#8C6C3E",
      skipped: "#B8BDD6",
      pending: "#9AA5CE",
      selection: "#D5D8EE",
      selectionDim: "#E7E8F2",
      overlay: "#FFFFFF",
      surface: "#FFFFFF",
    },
  },
  catppuccin: {
    dark: {
      foreground: "#CDD6F4",
      background: "#1E1E2E",
      accent: "#89B4FA",
      muted: "#A6ADC8",
      faint: "#585B70",
      success: "#A6E3A1",
      failure: "#F38BA8",
      running: "#F9E2AF",
      skipped: "#45475A",
      pending: "#7F849C",
      selection: "#2A2A44",
      selectionDim: "#1E1E30",
      overlay: "#000000",
      surface: "#111122",
    },
    light: {
      foreground: "#4C4F69",
      background: "#EFF1F5",
      accent: "#1E66F5",
      muted: "#6C6F85",
      faint: "#9CA0B0",
      success: "#40A02B",
      failure: "#D20F39",
      running: "#DF8E1D",
      skipped: "#BCC0CC",
      pending: "#8C8FA1",
      selection: "#D5D8EE",
      selectionDim: "#E7E8F2",
      overlay: "#FFFFFF",
      surface: "#FFFFFF",
    },
  },
  dracula: {
    dark: {
      foreground: "#F8F8F2",
      background: "#282A36",
      accent: "#BD93F9",
      muted: "#B0B4C4",
      faint: "#6272A4",
      success: "#50FA7B",
      failure: "#FF5555",
      running: "#F1FA8C",
      skipped: "#44475A",
      pending: "#8B94B8",
      selection: "#2A2A44",
      selectionDim: "#1E1E30",
      overlay: "#000000",
      surface: "#111122",
    },
    light: {
      foreground: "#1F1F28",
      background: "#F8F8F2",
      accent: "#7C4FC4",
      muted: "#575279",
      faint: "#9093A8",
      success: "#3B9B4F",
      failure: "#CC3E3E",
      running: "#B08900",
      skipped: "#D4D4DC",
      pending: "#7C86AD",
      selection: "#D5D8EE",
      selectionDim: "#E7E8F2",
      overlay: "#FFFFFF",
      surface: "#FFFFFF",
    },
  },
  gruvbox: {
    dark: {
      foreground: "#EBDBB2",
      background: "#282828",
      accent: "#FABD2F",
      muted: "#D5C4A1",
      faint: "#7C6F64",
      success: "#B8BB26",
      failure: "#FB4934",
      running: "#FABD2F",
      skipped: "#504945",
      pending: "#A89984",
      selection: "#2A2A44",
      selectionDim: "#1E1E30",
      overlay: "#000000",
      surface: "#111122",
    },
    light: {
      foreground: "#3C3836",
      background: "#FBF1C7",
      accent: "#B57614",
      muted: "#665C54",
      faint: "#928374",
      success: "#79740E",
      failure: "#9D0006",
      running: "#B57614",
      skipped: "#D5C4A1",
      pending: "#7C6F64",
      selection: "#D5D8EE",
      selectionDim: "#E7E8F2",
      overlay: "#FFFFFF",
      surface: "#FFFFFF",
    },
  },
  nord: {
    dark: {
      foreground: "#ECEFF4",
      background: "#2E3440",
      accent: "#88C0D0",
      muted: "#D8DEE9",
      faint: "#4C566A",
      success: "#A3BE8C",
      failure: "#BF616A",
      running: "#EBCB8B",
      skipped: "#434C5E",
      pending: "#7A8AA0",
      selection: "#2A2A44",
      selectionDim: "#1E1E30",
      overlay: "#000000",
      surface: "#111122",
    },
    light: {
      foreground: "#2E3440",
      background: "#ECEFF4",
      accent: "#5E81AC",
      muted: "#4C566A",
      faint: "#81A1C1",
      success: "#5E9A55",
      failure: "#BF616A",
      running: "#B98900",
      skipped: "#D8DEE9",
      pending: "#7A8AA0",
      selection: "#D5D8EE",
      selectionDim: "#E7E8F2",
      overlay: "#FFFFFF",
      surface: "#FFFFFF",
    },
  },
  "one-dark": {
    dark: {
      foreground: "#ABB2BF",
      background: "#282C34",
      accent: "#61AFEF",
      muted: "#ABB2BF",
      faint: "#5C6370",
      success: "#98C379",
      failure: "#E06C75",
      running: "#E5C07B",
      skipped: "#3E4451",
      pending: "#828997",
      selection: "#2A2A44",
      selectionDim: "#1E1E30",
      overlay: "#000000",
      surface: "#111122",
    },
    light: {
      foreground: "#383A42",
      background: "#FAFAFA",
      accent: "#4078F2",
      muted: "#696C77",
      faint: "#A0A1A7",
      success: "#50A14F",
      failure: "#E45649",
      running: "#C18401",
      skipped: "#D6D7DA",
      pending: "#8C8F97",
      selection: "#D5D8EE",
      selectionDim: "#E7E8F2",
      overlay: "#FFFFFF",
      surface: "#FFFFFF",
    },
  },
  rosepine: {
    dark: {
      foreground: "#E0DEF4",
      background: "#191724",
      accent: "#C4A7E7",
      muted: "#E0DEF4",
      faint: "#6E6A86",
      success: "#9CCFD8",
      failure: "#EB6F92",
      running: "#F6C177",
      skipped: "#393552",
      pending: "#8079A0",
      selection: "#2A2A44",
      selectionDim: "#1E1E30",
      overlay: "#000000",
      surface: "#111122",
    },
    light: {
      foreground: "#575279",
      background: "#FAF4ED",
      accent: "#907AA9",
      muted: "#6E6A86",
      faint: "#9893A5",
      success: "#56949F",
      failure: "#B4637A",
      running: "#EA9D34",
      skipped: "#DFDAD9",
      pending: "#8F8A9E",
      selection: "#D5D8EE",
      selectionDim: "#E7E8F2",
      overlay: "#FFFFFF",
      surface: "#FFFFFF",
    },
  },
}

// Not a real palette: the terminal's own ANSI colors. Foreground/background use
// the terminal defaults, so the app follows whatever scheme the user runs.
export const SYSTEM_COLORS: ThemeColors = {
  foreground: RGBA.defaultForeground(),
  background: RGBA.defaultBackground(),
  accent: RGBA.fromIndex(11), // bright yellow
  muted: RGBA.fromIndex(8), // bright black
  faint: RGBA.fromIndex(8),
  success: RGBA.fromIndex(10), // bright green
  failure: RGBA.fromIndex(9), // bright red
  running: RGBA.fromIndex(11),
  skipped: RGBA.fromIndex(0), // black
  pending: RGBA.fromIndex(8),
  selection: RGBA.fromIndex(4), // blue
  selectionDim: RGBA.fromIndex(8),
  overlay: RGBA.defaultBackground(),
  surface: RGBA.defaultBackground(),
}

export function isThemeName(name: string): name is SelectedTheme {
  return name === "system" || (THEME_NAMES as readonly string[]).includes(name)
}
