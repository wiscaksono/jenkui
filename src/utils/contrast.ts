// Picks a readable foreground (near-black or near-white) for a hex background,
// using perceptual luminance. Falls back to white for unparseable input.
export function readableTextColor(background: string): string {
  const hex = background.trim().replace(/^#/, "")
  if (hex.length !== 3 && hex.length !== 6) return "#FFFFFF"

  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex
  const r = Number.parseInt(full.slice(0, 2), 16)
  const g = Number.parseInt(full.slice(2, 4), 16)
  const b = Number.parseInt(full.slice(4, 6), 16)
  if ([r, g, b].some((n) => Number.isNaN(n))) return "#FFFFFF"

  // Rec. 601 luma.
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luma > 0.6 ? "#111111" : "#FFFFFF"
}
