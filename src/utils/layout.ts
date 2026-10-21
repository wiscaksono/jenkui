// Terminal layout breakpoints. Kept pure so the responsive decisions are
// testable without mounting a renderer.
export const MIN_WIDTH = 30
export const MIN_HEIGHT = 10

export type Layout = {
  width: number
  height: number
  compact: boolean
  narrow: boolean
  short: boolean
  tooSmall: boolean
  showStatus: boolean
  showSecondary: boolean
  /** Whether the stage overview fits as a row of cards. */
  stageCards: (stageCount: number) => boolean
}

export function layoutFor(width: number, height: number): Layout {
  const w = width > 0 ? Math.floor(width) : 80
  const h = height > 0 ? Math.floor(height) : 24
  return {
    width: w,
    height: h,
    compact: w < 80,
    narrow: w < 65,
    short: h < 24,
    tooSmall: w < MIN_WIDTH || h < MIN_HEIGHT,
    showStatus: w >= 80,
    showSecondary: w >= 80,
    // A card needs roughly 22 columns to keep its name and duration readable.
    stageCards: (stageCount: number) => w >= 100 && stageCount <= Math.max(3, Math.floor(w / 22)),
  }
}

export function dialogWidth(preferred: number, width: number): number {
  return Math.max(24, Math.min(preferred, width - 4))
}

export function dialogHeight(preferred: number, height: number): number {
  return Math.max(6, Math.min(preferred, height - 2))
}
