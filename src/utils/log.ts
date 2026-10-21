import type { AnsiSpan, AnsiStyle, LogChunk, LogLine } from "../types"

// Parsing helpers for Jenkins progressive log text. Kept pure so the fiddly
// bits (ANSI escapes, CRLF, append offsets, style carry-over) are testable
// without a renderer.

const CREDENTIAL_MARKER = /ha:\/\/\/\//
// eslint-disable-next-line no-control-regex -- ANSI escapes are control characters
const CSI = /\x1b\[([0-9;?]*)([ -/]*)([@-~])/g
// OSC sequences (hyperlinks, terminal titles) end with BEL or ST.
// eslint-disable-next-line no-control-regex -- ANSI escapes are control characters
const OSC = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g

export const MAX_LOG_LINES = 4000

export const EMPTY_STYLE: AnsiStyle = {}

export function stripAnsi(text: string): string {
  return text.replace(OSC, "").replace(CSI, "")
}

function xterm256(index: number): string | undefined {
  if (index < 16) return undefined
  if (index >= 232) {
    const level = 8 + (index - 232) * 10
    return `#${[level, level, level].map((n) => n.toString(16).padStart(2, "0")).join("")}`
  }
  const cube = [0, 95, 135, 175, 215, 255]
  const n = index - 16
  const r = cube[Math.floor(n / 36)] ?? 0
  const g = cube[Math.floor((n % 36) / 6)] ?? 0
  const b = cube[n % 6] ?? 0
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`
}

function applySgr(style: AnsiStyle, params: string): AnsiStyle {
  const codes = params.length === 0 ? [0] : params.split(";").map((part) => Number.parseInt(part, 10) || 0)
  let next: AnsiStyle = { ...style }
  for (let i = 0; i < codes.length; i++) {
    const code = codes[i]!
    if (code === 0) next = {}
    else if (code === 1) next.bold = true
    else if (code === 2) next.dim = true
    else if (code === 3) next.italic = true
    else if (code === 4) next.underline = true
    else if (code === 22) {
      next.bold = false
      next.dim = false
    } else if (code === 23) next.italic = false
    else if (code === 24) next.underline = false
    else if (code >= 30 && code <= 37) next.fg = { index: code - 30 }
    else if (code === 39) next.fg = undefined
    else if (code >= 90 && code <= 97) next.fg = { index: code - 90 + 8 }
    else if (code === 38) {
      const mode = codes[i + 1]
      if (mode === 5) {
        const index = codes[i + 2] ?? 0
        next.fg = { index, rgb: xterm256(index) }
        i += 2
      } else if (mode === 2) {
        const r = codes[i + 2] ?? 0
        const g = codes[i + 3] ?? 0
        const b = codes[i + 4] ?? 0
        const hex = (value: number) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")
        next.fg = { rgb: `#${hex(r)}${hex(g)}${hex(b)}` }
        i += 4
      }
    }
  }
  return next
}

/** Splits one line into styled spans. Other CSI sequences (cursor moves etc.) are dropped. */
export function parseSpans(text: string, initial: AnsiStyle = EMPTY_STYLE): { spans: AnsiSpan[]; style: AnsiStyle } {
  const spans: AnsiSpan[] = []
  let style = initial
  let cursor = 0
  CSI.lastIndex = 0
  for (;;) {
    const match = CSI.exec(text)
    if (match === null) break
    if (match.index > cursor) spans.push({ text: text.slice(cursor, match.index), style })
    if (match[3] === "m") style = applySgr(style, match[1] ?? "")
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) spans.push({ text: text.slice(cursor), style })
  return { spans, style }
}

function redactMarker(line: string): boolean {
  return CREDENTIAL_MARKER.test(line)
}

// Splits a progressive chunk into complete lines, keeping any partial trailing
// line in `carry` so a poll never renders half a line. Style state follows the
// incomplete line, so a color opened before a chunk boundary survives.
export function appendLog(previousCarry: string, chunk: string, previousStyle: AnsiStyle = EMPTY_STYLE): LogChunk {
  const text = (previousCarry + chunk).replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(OSC, "")
  const parts = text.split("\n")
  const carry = parts.pop() ?? ""
  const lines: LogLine[] = []
  let style = previousStyle
  for (const raw of parts) {
    const parsed = parseSpans(raw, style)
    style = parsed.style
    // Jenkins replaces masked credentials with an encrypted "ha:////<base64>"
    // marker. It is noise at best and sensitive at worst, so drop those lines.
    if (!redactMarker(raw)) lines.push(parsed.spans)
  }
  return { lines, carry, style }
}

/** Appends parsed lines with a hard cap so a long-running pipeline cannot grow memory forever. */
export function appendLines(previous: LogLine[], incoming: LogLine[], max = MAX_LOG_LINES): LogLine[] {
  if (incoming.length === 0) return previous
  const next = previous.concat(incoming)
  return next.length > max ? next.slice(next.length - max) : next
}

export function spansToString(spans: AnsiSpan[]): string {
  return spans.map((span) => span.text).join("")
}

export type HighlightedSpan = AnsiSpan & { hit: boolean }

/** Splits spans so every case-insensitive match of `query` is marked as a hit. */
export function highlightSpans(spans: AnsiSpan[], query: string): HighlightedSpan[] {
  const plain = spans.map((span) => ({ ...span, hit: false }))
  const q = query.trim().toLowerCase()
  if (!q) return plain

  const text = spansToString(spans)
  const lower = text.toLowerCase()
  const ranges: Array<[number, number]> = []
  let index = lower.indexOf(q)
  while (index !== -1) {
    ranges.push([index, index + q.length])
    index = lower.indexOf(q, index + q.length)
  }
  if (ranges.length === 0) return plain

  const result: HighlightedSpan[] = []
  let offset = 0
  let range = 0
  for (const span of spans) {
    let cursor = 0
    while (cursor < span.text.length) {
      const absolute = offset + cursor
      while (range < ranges.length && ranges[range]![1] <= absolute) range++
      const current = ranges[range]
      if (!current || absolute < current[0]) {
        // Text before the next match.
        const end = current ? Math.min(span.text.length, current[0] - offset) : span.text.length
        result.push({ text: span.text.slice(cursor, end), style: span.style, hit: false })
        cursor = end
      } else {
        // Inside a match: stop at the match end (or span end).
        const end = Math.min(span.text.length, current[1] - offset)
        result.push({ text: span.text.slice(cursor, end), style: span.style, hit: true })
        cursor = end
      }
    }
    offset += span.text.length
  }
  return result
}
