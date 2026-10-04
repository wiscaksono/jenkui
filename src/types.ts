export type StageStatus = "SUCCESS" | "FAILURE" | "RUNNING" | "SKIPPED" | "PENDING"

export type Stage = {
  name: string
  durationMs: number
  status: StageStatus
  startedAt: string
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

export type View = "org" | "project" | "deploy" | "run"
