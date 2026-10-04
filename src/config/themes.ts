export type ThemeColors = {
  accent: string
  muted: string
  faint: string
  success: string
  failure: string
  running: string
  skipped: string
  pending: string
}

// Named color presets, a small subset of the palettes OpenCode ships. Each one
// provides the eight tokens this app renders. `ajsdb` is the built-in default.
export const THEMES = {
  ajsdb: {
    accent: "#FFFF00",
    muted: "#888888",
    faint: "#666666",
    success: "#5FD75F",
    failure: "#FF5F5F",
    running: "#FFD75F",
    skipped: "#555555",
    pending: "#7A8899",
  },
  tokyonight: {
    accent: "#7AA2F7",
    muted: "#9AA5CE",
    faint: "#565F89",
    success: "#9ECE6A",
    failure: "#F7768E",
    running: "#E0AF68",
    skipped: "#414868",
    pending: "#6D7A9C",
  },
  catppuccin: {
    accent: "#89B4FA",
    muted: "#A6ADC8",
    faint: "#585B70",
    success: "#A6E3A1",
    failure: "#F38BA8",
    running: "#F9E2AF",
    skipped: "#45475A",
    pending: "#7F849C",
  },
  dracula: {
    accent: "#BD93F9",
    muted: "#B0B4C4",
    faint: "#6272A4",
    success: "#50FA7B",
    failure: "#FF5555",
    running: "#F1FA8C",
    skipped: "#44475A",
    pending: "#8B94B8",
  },
  gruvbox: {
    accent: "#FABD2F",
    muted: "#D5C4A1",
    faint: "#7C6F64",
    success: "#B8BB26",
    failure: "#FB4934",
    running: "#FABD2F",
    skipped: "#504945",
    pending: "#A89984",
  },
  nord: {
    accent: "#88C0D0",
    muted: "#D8DEE9",
    faint: "#4C566A",
    success: "#A3BE8C",
    failure: "#BF616A",
    running: "#EBCB8B",
    skipped: "#434C5E",
    pending: "#7A8AA0",
  },
  "one-dark": {
    accent: "#61AFEF",
    muted: "#ABB2BF",
    faint: "#5C6370",
    success: "#98C379",
    failure: "#E06C75",
    running: "#E5C07B",
    skipped: "#3E4451",
    pending: "#828997",
  },
  rosepine: {
    accent: "#C4A7E7",
    muted: "#E0DEF4",
    faint: "#6E6A86",
    success: "#9CCFD8",
    failure: "#EB6F92",
    running: "#F6C177",
    skipped: "#393552",
    pending: "#8079A0",
  },
} as const satisfies Record<string, ThemeColors>

export function themeNames(): string[] {
  return Object.keys(THEMES)
}
