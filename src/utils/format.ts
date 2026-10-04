import type { StageStatus } from "../types"

export function formatDuration(ms: number): string {
  if (ms <= 0) return "-"
  if (ms < 1000) return `${ms}ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${Number.isInteger(seconds) ? seconds : Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return `${minutes}m${rest}s`
}

/** Icon + short label per status, e.g. FAILURE -> { "✗", "FAILED" }. */
export const STATUS_META: Record<StageStatus, { glyph: string; label: string }> = {
  SUCCESS: { glyph: "\u{f00c}", label: "SUCCESS" },
  FAILURE: { glyph: "\u{f00d}", label: "FAILED" },
  RUNNING: { glyph: "\u{f04b}", label: "RUNNING" },
  SKIPPED: { glyph: "\u{f068}", label: "DISABLED" },
  PENDING: { glyph: "\u{f10c}", label: "PENDING" },
}

