import { describe, expect, test } from "bun:test"
import { deriveStatus, encodeStatus, programStatusEnabled } from "./status"

const OSC = "\u001b]7501;"
const ST = "\u001b\\"

const decode = (sequence: string, key: string): string => {
  const body = sequence.slice(OSC.length, -ST.length)
  const pair = body.split(":").find((entry) => entry.startsWith(`${key}=`))
  return Buffer.from(pair!.slice(key.length + 1), "base64").toString("utf8")
}

describe("encodeStatus", () => {
  test("builds the documented pairs in order", () => {
    const sequence = encodeStatus({ state: "working", progress: 40.4, msg: "Pushing image" })
    expect(sequence.startsWith(`${OSC}state=working:app=jenkui:progress=40:msg=`)).toBe(true)
    expect(sequence.endsWith(ST)).toBe(true)
    expect(decode(sequence, "msg")).toBe("Pushing image")
  })

  test("kind and progress only ride along where the spec allows them", () => {
    expect(encodeStatus({ state: "blocked", kind: "permission", msg: "Approve?" })).toContain("kind=permission")
    expect(encodeStatus({ state: "blocked", kind: "question" })).not.toContain("progress=")
    expect(encodeStatus({ state: "done", progress: 90 })).not.toContain("progress=")
    expect(encodeStatus({ state: "working", progress: 140 })).toContain("progress=100")
    expect(encodeStatus({ state: "working", progress: -3 })).toContain("progress=0")
  })

  test("control characters never reach the message", () => {
    const sequence = encodeStatus({ state: "error", msg: "build\u0007 failed\nline two" })
    const msg = decode(sequence, "msg")
    expect(msg).toBe("build failed line two")
    for (const char of msg) {
      const code = char.codePointAt(0) ?? 0
      expect(code < 0x20 || (code >= 0x7f && code <= 0x9f)).toBe(false)
    }
  })

  test("a long message is shortened under the sequence cap", () => {
    const sequence = encodeStatus({ state: "working", msg: "x".repeat(4000) })
    expect(sequence.length).toBeLessThanOrEqual(4096)
    expect(decode(sequence, "msg").length).toBeGreaterThan(0)
  })

  test("clear keeps the app id and drops the rest", () => {
    expect(encodeStatus({ state: "clear" })).toBe(`${OSC}state=clear:app=jenkui${ST}`)
  })
})

describe("programStatusEnabled", () => {
  test("unknown terminals are left alone", () => {
    expect(programStatusEnabled({ TERM_PROGRAM: "iTerm.app" })).toBe(false)
    expect(programStatusEnabled({})).toBe(false)
  })

  test("rex and ghostty get reports", () => {
    expect(programStatusEnabled({ TERM_PROGRAM: "rex" })).toBe(true)
    expect(programStatusEnabled({ TERM_PROGRAM: "Ghostty" })).toBe(true)
  })

  test("JENKUI_STATUS overrides the allowlist both ways", () => {
    expect(programStatusEnabled({ TERM_PROGRAM: "iTerm.app", JENKUI_STATUS: "1" })).toBe(true)
    expect(programStatusEnabled({ TERM_PROGRAM: "rex", JENKUI_STATUS: "off" })).toBe(false)
  })
})

describe("deriveStatus", () => {
  const base = { busy: false, view: "project" as const, live: false, loading: false }

  test("dialogs block on the user", () => {
    expect(deriveStatus({ ...base, confirm: "Start a new build of web?" })).toEqual({
      state: "blocked",
      kind: "permission",
      msg: "Start a new build of web?",
    })
    expect(deriveStatus({ ...base, params: "Build parameters for web" })).toEqual({
      state: "blocked",
      kind: "question",
      msg: "Build parameters for web",
    })
  })

  test("work in flight is working, with the notice as the message", () => {
    expect(deriveStatus({ ...base, busy: true, notice: "Triggering build\u2026" })).toEqual({
      state: "working",
      msg: "Triggering build\u2026",
    })
    expect(
      deriveStatus({
        ...base,
        busy: true,
        view: "run",
        live: true,
        progress: 50,
        projectName: "web",
        deploymentName: "#12",
      }),
    ).toEqual({ state: "working", msg: "Working" })
  })

  test("a live stream reports progress, a finished one its result", () => {
    expect(
      deriveStatus({ ...base, view: "run", live: true, progress: 33, projectName: "web", deploymentName: "#12" }),
    ).toEqual({ state: "working", progress: 33, msg: "web #12 running" })
    expect(
      deriveStatus({
        ...base,
        view: "run",
        result: "SUCCESS",
        projectName: "web",
        deploymentName: "#12",
      }),
    ).toEqual({ state: "done", msg: "web #12 SUCCESS" })
    expect(
      deriveStatus({ ...base, view: "run", result: "FAILURE", projectName: "web", deploymentName: "#12" }),
    ).toEqual({ state: "error", msg: "web #12 FAILURE" })
  })

  test("an older build keeps the status from the list", () => {
    expect(deriveStatus({ ...base, view: "deploy", deploymentStatus: "ABORTED" })).toEqual({
      state: "error",
      msg: "Build ABORTED",
    })
  })

  test("loading and request failures are visible, everything else idles", () => {
    expect(deriveStatus({ ...base, loading: true })).toEqual({ state: "working", msg: "Loading organizations" })
    expect(deriveStatus({ ...base, error: "getaddrinfo ENOTFOUND" })).toEqual({
      state: "error",
      msg: "getaddrinfo ENOTFOUND",
    })
    expect(deriveStatus(base)).toEqual({ state: "idle" })
  })
})
