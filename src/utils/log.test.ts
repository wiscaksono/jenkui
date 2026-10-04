import { describe, expect, test } from "bun:test"
import { appendLog, stripAnsi } from "./log"

describe("stripAnsi", () => {
  test("removes color and other CSI sequences", () => {
    expect(stripAnsi("\x1b[31merror\x1b[0m done")).toBe("error done")
    expect(stripAnsi("\x1b[0mplain")).toBe("plain")
  })

  test("leaves normal text untouched", () => {
    expect(stripAnsi("no escapes here")).toBe("no escapes here")
  })
})

describe("appendLog", () => {
  test("splits on newlines and keeps a partial trailing line", () => {
    const a = appendLog("", "line1\nline2\npartial")
    expect(a.lines).toEqual(["line1", "line2"])
    expect(a.carry).toBe("partial")
  })

  test("carries the partial line into the next chunk", () => {
    const a = appendLog("", "hello wor")
    expect(a.lines).toEqual([])
    const b = appendLog(a.carry, "ld\nnext")
    expect(b.lines).toEqual(["hello world"])
    expect(b.carry).toBe("next")
  })

  test("normalizes CRLF and lone CR (progress bars)", () => {
    const a = appendLog("", "a\r\nb\rc\n")
    expect(a.lines).toEqual(["a", "b", "c"])
    expect(a.carry).toBe("")
  })

  test("strips ANSI before splitting", () => {
    const a = appendLog("", "\x1b[32mok\x1b[0m\n")
    expect(a.lines).toEqual(["ok"])
  })

  test("drops Jenkins masked-credential marker lines", () => {
    // "ha:////<base64>" is a console-note for masked credentials, not real output.
    const a = appendLog("", "[Pipeline] sh\nha:////4BDM0gtHUhrGLqnL\n+ pwd\n")
    expect(a.lines).toEqual(["[Pipeline] sh", "+ pwd"])
  })

  test("drops a marker even when it carries other text", () => {
    const a = appendLog("", "ha:////abc[Pipeline] }\nkeep me\n")
    expect(a.lines).toEqual(["keep me"])
  })
})
