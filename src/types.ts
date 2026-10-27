export type StageStatus =
  | "SUCCESS"
  | "FAILURE"
  | "RUNNING"
  | "ABORTED"
  | "UNSTABLE"
  | "PAUSED"
  | "SKIPPED"
  | "PENDING"

export type Stage = {
  name: string
  durationMs: number
  status: StageStatus
  startedAt: string
  /** How long this stage took in the previous build, used to guess its progress. */
  estimateMs?: number
}

export type Deployment = {
  name: string
  status: StageStatus
  number: number
  date: string
  time: string
  commits: number
  building: boolean
}

export type Project = {
  name: string
  path: string
  status: StageStatus
  /** Folder the job lives in (prod), or undefined when it sits directly in a view. */
  folder?: string
}

export type Organization = {
  name: string
  projects: Project[]
}

/** A job parameter as Jenkins describes it, plus the value the user is editing. */
export type BuildParam = {
  name: string
  type: string
  description?: string
  defaultValue: string
  choices?: string[]
}

export type ParamField = BuildParam & { value: string }

export type BuildParamValue = { name: string; value: string; secret?: boolean }

export type AnsiColor = { index?: number; rgb?: string }

export type AnsiStyle = {
  fg?: AnsiColor
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
}

export type AnsiSpan = { text: string; style: AnsiStyle }

export type LogLine = AnsiSpan[]

export type LogChunk = { lines: LogLine[]; carry: string; style: AnsiStyle }

export type View = "org" | "project" | "deploy" | "run"
