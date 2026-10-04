import type { StageStatus } from "../types"
import { themeConfig } from "./index"

// Merged defaults + ~/.config/jenkui/theme.json overrides. Import sites keep
// using `colors` / `statusColor`; only this module knows about the file.
export const colors = themeConfig.colors

/** Background color for a profile badge, or undefined to fall back to faint. */
export function profileColor(name: string): string {
  return themeConfig.profileColors[name] ?? colors.faint
}

export const statusColor: Record<StageStatus, string> = {
  SUCCESS: colors.success,
  FAILURE: colors.failure,
  RUNNING: colors.running,
  SKIPPED: colors.skipped,
  PENDING: colors.pending,
}
