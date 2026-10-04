// Parsing helpers for Jenkins progressive log text. Kept pure so the fiddly
// bits (ANSI escapes, CRLF, append offsets) are testable without a renderer.

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]/g
// Jenkins replaces masked credentials with an encrypted "ha:////<base64>"
// marker. It is noise at best and sensitive at worst, so drop those lines.
const CREDENTIAL_MARKER = /ha:\/\/\/\//

export function stripAnsi(text: string): string {
  return text.replace(ANSI, "")
}

export type LogChunk = {
  /** Complete lines ready to render. */
  lines: string[]
  /** Trailing text with no newline yet; carry it into the next chunk. */
  carry: string
}

// Splits a progressive chunk into complete lines, keeping any partial trailing
// line in `carry` so a poll never renders half a line.
export function appendLog(previousCarry: string, chunk: string): LogChunk {
  const text = stripAnsi(previousCarry + chunk).replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const parts = text.split("\n")
  const carry = parts.pop() ?? ""
  const lines = parts.filter((line) => !CREDENTIAL_MARKER.test(line))
  return { lines, carry }
}
