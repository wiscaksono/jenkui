// A stage bar is a solid run of `█` up to the guessed progress point, followed
// by a full braille block for the rest. Jenkins only reports how long a stage
// has been running, so the progress point comes from that stage's duration in
// the previous build.
const FILL = "█"
const TRACK = "⣿"

// The cell at the boundary pulses through these frames, so the head of the bar
// looks alive without turning the whole track into noise.
const WAVE = ["⣿", "⣷", "⣯", "⣟", "⡿", "⢿", "⣻", "⣽"]

export type BarParts = { fill: string; head: string; rail: string }

/**
 * Share of the estimate the stage already spent, capped just below 100% so a
 * running stage never looks finished. Null when there is nothing to compare to.
 */
export function stageRatio(durationMs: number, estimateMs: number | undefined): number | null {
  if (!estimateMs || estimateMs <= 0) return null
  return Math.min(Math.max(durationMs, 0) / estimateMs, 0.99)
}

/**
 * Splits a `width`-cell bar at `ratio`: `█` before the progress point, then the
 * pulsing head cell, then braille. A null ratio means the length is unknown, so
 * the whole row scrolls the wave instead. A bar below 100% always keeps the head
 * cell, otherwise a nearly done stage would look done.
 */
export function progressBar(ratio: number | null, width: number, frame = 0): BarParts {
  if (width <= 0) return { fill: "", head: "", rail: "" }

  const offset = Math.abs(Math.floor(frame)) % WAVE.length

  if (ratio === null) {
    let fill = ""
    for (let index = 0; index < width; index++) fill += WAVE[(index + offset) % WAVE.length]!
    return { fill, head: "", rail: "" }
  }

  const clamped = Math.min(Math.max(ratio, 0), 1)
  const limit = clamped >= 1 ? width : Math.max(width - 1, 0)
  const cells = Math.min(clamped > 0 ? Math.max(Math.round(clamped * width), 1) : 0, limit)
  return {
    fill: FILL.repeat(cells),
    head: cells < width ? WAVE[offset]! : "",
    rail: TRACK.repeat(width - cells - (cells < width ? 1 : 0)),
  }
}
