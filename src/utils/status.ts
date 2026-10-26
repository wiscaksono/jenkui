import type { StageStatus } from "../types"

/**
 * OSC 7501, the Program Status Protocol: the program reports what it is doing
 * and the terminal keeps the last records. Unknown OSCs must be ignored, so
 * emitting blindly is safe, but we still gate it to terminals known to show it.
 */
const SUPPORTED_TERM_PROGRAMS = new Set(["rex", "ghostty"])

const APP = "jenkui"
const MAX_SEQUENCE_BYTES = 4096
const MAX_MSG_BYTES = 2048

export type StatusState = "idle" | "working" | "done" | "blocked" | "error"
export type BlockedKind = "permission" | "question" | "auth"

export type StatusReport = {
  state: StatusState | "clear"
  kind?: BlockedKind
  msg?: string
  progress?: number
}

export type StatusSink = { write(chunk: string): unknown }

type Env = Record<string, string | undefined>

const TRUTHY = new Set(["1", "true", "on", "yes"])
const FALSY = new Set(["0", "false", "off", "no"])

/** JENKUI_STATUS overrides the terminal allowlist both ways. */
export function programStatusEnabled(env: Env = process.env): boolean {
  const override = env.JENKUI_STATUS?.trim().toLowerCase()
  if (override && TRUTHY.has(override)) return true
  if (override && FALSY.has(override)) return false
  return SUPPORTED_TERM_PROGRAMS.has((env.TERM_PROGRAM ?? "").trim().toLowerCase())
}

// Control characters would make the terminal drop the whole report, and they
// can never be meaningful in a one-line message.
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g

function encodeText(text: string): string {
  let clean = text.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, MAX_MSG_BYTES)
  // The cap is in bytes, so a multibyte message needs trimming after slicing.
  while (Buffer.byteLength(clean, "utf8") > MAX_MSG_BYTES) clean = clean.slice(0, -1)
  return Buffer.from(clean, "utf8").toString("base64")
}

export function encodeStatus(report: StatusReport): string {
  const pairs = [`state=${report.state}`, `app=${APP}`]
  if (report.state === "blocked" && report.kind) pairs.push(`kind=${report.kind}`)
  if ((report.state === "working" || report.state === "blocked") && report.progress !== undefined) {
    const clamped = Math.max(0, Math.min(100, Math.round(report.progress)))
    pairs.push(`progress=${clamped}`)
  }

  let msg = report.msg
  if (msg) pairs.push(`msg=${encodeText(msg)}`)

  let body = pairs.join(":")
  // Keep the whole sequence under the cap by shortening the message.
  while (body.length + 9 > MAX_SEQUENCE_BYTES && msg) {
    msg = msg.slice(0, Math.floor(msg.length / 2))
    pairs[pairs.length - 1] = msg ? `msg=${encodeText(msg)}` : `msg=`
    body = pairs.join(":")
  }
  return `\u001b]7501;${body}\u001b\\`
}

export function writeStatus(report: StatusReport, sink: StatusSink = process.stdout, env: Env = process.env): string | null {
  if (!programStatusEnabled(env)) return null
  const sequence = encodeStatus(report)
  sink.write(sequence)
  return sequence
}

export function clearStatus(sink: StatusSink = process.stdout, env: Env = process.env): string | null {
  return writeStatus({ state: "clear" }, sink, env)
}

export type StatusInput = {
  confirm?: string
  params?: string
  busy: boolean
  notice?: string
  view: "org" | "project" | "deploy" | "run"
  projectName?: string
  deploymentName?: string
  deploymentStatus?: StageStatus
  result?: StageStatus | null
  live: boolean
  progress?: number
  loading: boolean
  error?: string | null
}

const DONE_STATES = new Set<StageStatus>(["SUCCESS", "UNSTABLE"])
const ERROR_STATES = new Set<StageStatus>(["FAILURE", "ABORTED"])

/**
 * One report for the whole app: a dialog asks the user, work in flight is
 * `working`, a finished build is `done` or `error`, everything else idles.
 */
export function deriveStatus(input: StatusInput): StatusReport {
  const build = [input.projectName, input.deploymentName].filter(Boolean).join(" ")

  if (input.confirm) return { state: "blocked", kind: "permission", msg: input.confirm }
  if (input.params) return { state: "blocked", kind: "question", msg: input.params }
  if (input.busy) return { state: "working", msg: input.notice ?? "Working" }
  if (input.view === "run" && input.live) {
    return { state: "working", progress: input.progress, msg: `${build || "Build"} running` }
  }

  const status = input.view === "run" ? (input.result ?? input.deploymentStatus) : input.deploymentStatus
  if (status && DONE_STATES.has(status)) return { state: "done", msg: `${build || "Build"} ${status}` }
  if (status && ERROR_STATES.has(status)) return { state: "error", msg: `${build || "Build"} ${status}` }
  if (input.loading) return { state: "working", msg: "Loading organizations" }
  if (input.error) return { state: "error", msg: input.error }
  return { state: "idle" }
}
