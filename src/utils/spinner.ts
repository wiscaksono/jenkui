const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

// Pure frame lookup; the animation itself lives in hooks/use-spinner.
export function spinnerFrame(tick: number): string {
  return FRAMES[tick % FRAMES.length] ?? FRAMES[0]!
}
