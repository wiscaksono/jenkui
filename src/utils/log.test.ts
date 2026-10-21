import { describe, expect, test } from "bun:test"
import { appendLines, appendLog, highlightSpans, parseSpans, spansToString, stripAnsi } from "./log"
import type { LogLine } from "../types"

const textOf = (lines: LogLine[]): string[] => lines.map(spansToString)

describe("stripAnsi", () => {
  test("removes color and other CSI sequences", () => {
    expect(stripAnsi("\x1b[31merror\x1b[0m done")).toBe("error done")
    expect(stripAnsi("\x1b[0mplain")).toBe("plain")
    expect(stripAnsi("\x1b[2Kprogress")).toBe("progress")
    expect(stripAnsi("\x1b]8;;https://example.com\x07link\x1b]8;;\x07")).toBe("link")
  })

  test("leaves normal text untouched", () => {
    expect(stripAnsi("no escapes here")).toBe("no escapes here")
  })
})

describe("parseSpans", () => {
  test("keeps foreground colors and resets them", () => {
    const parsed = parseSpans("\x1b[31merror\x1b[0m done")
    expect(parsed.spans.map((span) => span.text)).toEqual(["error", " done"])
    expect(parsed.spans[0]?.style.fg).toEqual({ index: 1 })
    expect(parsed.spans[1]?.style.fg).toBeUndefined()
  })

  test("maps bright colors to the upper half of the ANSI palette", () => {
    expect(parseSpans("\x1b[91mred").spans[0]?.style.fg).toEqual({ index: 9 })
  })

  test("supports 256-color and truecolor SGR", () => {
    expect(parseSpans("\x1b[38;5;196mred").spans[0]?.style.fg).toEqual({ index: 196, rgb: "#ff0000" })
    expect(parseSpans("\x1b[38;2;1;2;3mrgb").spans[0]?.style.fg).toEqual({ rgb: "#010203" })
  })

  test("keeps bold and dim flags", () => {
    const parsed = parseSpans("\x1b[1;2mstyled")
    expect(parsed.spans[0]?.style.bold).toBe(true)
    expect(parsed.spans[0]?.style.dim).toBe(true)
    expect(parseSpans("\x1b[1;2mstyled\x1b[22mplain").spans[1]?.style.bold).toBe(false)
  })
})

describe("appendLog", () => {
  test("splits on newlines and keeps a partial trailing line", () => {
    const a = appendLog("", "line1\nline2\npartial")
    expect(textOf(a.lines)).toEqual(["line1", "line2"])
    expect(a.carry).toBe("partial")
  })

  test("carries the partial line into the next chunk", () => {
    const a = appendLog("", "hello wor")
    expect(a.lines).toEqual([])
    const b = appendLog(a.carry, "ld\nnext", a.style)
    expect(textOf(b.lines)).toEqual(["hello world"])
    expect(b.carry).toBe("next")
  })

  test("carries an open color across a chunk boundary", () => {
    const a = appendLog("", "\x1b[32mgre")
    const b = appendLog(a.carry, "en\n", a.style)
    expect(textOf(b.lines)).toEqual(["green"])
    expect(b.lines[0]?.[0]?.style.fg).toEqual({ index: 2 })
  })

  test("normalizes CRLF and lone CR (progress bars)", () => {
    const a = appendLog("", "a\r\nb\rc\n")
    expect(textOf(a.lines)).toEqual(["a", "b", "c"])
    expect(a.carry).toBe("")
  })

  test("keeps ANSI colors instead of throwing them away", () => {
    const a = appendLog("", "\x1b[32mok\x1b[0m\n")
    expect(textOf(a.lines)).toEqual(["ok"])
    expect(a.lines[0]?.[0]?.style.fg).toEqual({ index: 2 })
  })

  test("drops Jenkins masked-credential marker lines", () => {
    // "ha:////<base64>" is a console-note for masked credentials, not real output.
    const a = appendLog("", "[Pipeline] sh\nha:////4BDM0gtHUhrGLqnL\n+ pwd\n")
    expect(textOf(a.lines)).toEqual(["[Pipeline] sh", "+ pwd"])
  })

  test("drops a marker even when it carries other text", () => {
    const a = appendLog("", "ha:////abc[Pipeline] }\nkeep me\n")
    expect(textOf(a.lines)).toEqual(["keep me"])
  })
})

describe("appendLines", () => {
  test("caps the buffer and keeps the newest lines", () => {
    const line = (text: string): LogLine => [{ text, style: {} }]
    const existing = [line("a"), line("b"), line("c")]
    const next = appendLines(existing, [line("d"), line("e")], 3)
    expect(textOf(next)).toEqual(["c", "d", "e"])
  })

  test("returns the previous array when nothing is appended", () => {
    const existing: LogLine[] = []
    expect(appendLines(existing, [])).toBe(existing)
  })
})

describe("highlightSpans", () => {
  test("marks matches without changing the text", () => {
    const spans = parseSpans("\x1b[32mfoo\x1b[0m ERROR bar").spans
    const marked = highlightSpans(spans, "error")
    expect(spansToString(marked)).toBe("foo ERROR bar")
    expect(marked.filter((span) => span.hit).map((span) => span.text)).toEqual(["ERROR"])
  })

  test("finds a match that crosses style boundaries", () => {
    const spans = [
      { text: "foo ER", style: {} },
      { text: "ROR bar", style: {} },
    ]
    const marked = highlightSpans(spans, "error")
    expect(marked.filter((span) => span.hit).map((span) => span.text)).toEqual(["ER", "ROR"])
  })

  test("returns every span unmarked when the query is empty", () => {
    const spans = parseSpans("plain text").spans
    expect(highlightSpans(spans, "  ").every((span) => !span.hit)).toBe(true)
  })
})
