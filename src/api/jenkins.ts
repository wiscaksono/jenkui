import type { Deployment, Organization, Stage, StageStatus } from "../types"
import { config, getActiveProfile } from "../config"

export const PAGE_SIZE = config.pageSize

function authHeader(): string {
  const { user, token } = getActiveProfile()
  return `Basic ${Buffer.from(`${user}:${token}`).toString("base64")}`
}

async function get<T>(path: string): Promise<T> {
  const profile = getActiveProfile()
  if (!profile.user || !profile.token) {
    throw new Error(
      "Missing Jenkins credentials. Set them in ~/.config/jenkui/config.json (or JENKINS_USER/JENKINS_TOKEN).",
    )
  }
  const res = await fetch(`${profile.url}${path}`, {
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    throw new Error(`Jenkins ${res.status} ${res.statusText}: ${path}`)
  }
  return (await res.json()) as T
}

// Write requests (trigger/stop). Jenkins answers 200/201/302 on success.
async function post(path: string): Promise<void> {
  const profile = getActiveProfile()
  if (!profile.user || !profile.token) {
    throw new Error("Missing Jenkins credentials for the active profile.")
  }
  const res = await fetch(`${profile.url}${path}`, {
    method: "POST",
    headers: { Authorization: authHeader() },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    throw new Error(`Jenkins ${res.status} ${res.statusText}: POST ${path}`)
  }
}

/** Best-effort build number from a queue item; undefined while still queued. */
export async function fetchQueuedBuildNumber(queueUrl: string): Promise<number | undefined> {
  const profile = getActiveProfile()
  const path = queueUrl.startsWith("http") ? queueUrl.slice(queueUrl.indexOf("/queue/")) : queueUrl
  const res = await fetch(`${profile.url}${path}api/json?tree=executable%5Bnumber%5D,cancelled`, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return undefined
  const data = (await res.json()) as { executable?: { number?: number } }
  return data.executable?.number
}

export async function triggerBuild(jobPath: string): Promise<void> {
  // delay=0sec skips the default quiet period, matching the web "Build Now".
  await post(`/job/${jobPath}/build?delay=0sec`)
}

export async function stopBuild(jobPath: string, buildNumber: number): Promise<void> {
  await post(`/job/${jobPath}/${buildNumber}/stop`)
}

export function buildConsoleUrl(jobPath: string, buildNumber: number): string {
  const { url } = getActiveProfile()
  return `${url.replace(/\/+$/, "")}/job/${jobPath}/${buildNumber}/console`
}

export function jobUrl(jobPath: string): string {
  const { url } = getActiveProfile()
  return `${url.replace(/\/+$/, "")}/job/${jobPath}/`
}

export type QueueItem = {
  id: number
  name: string
  why: string | null
  buildNumber?: number
}

type RawQueueItem = {
  id: number
  task?: { name?: string }
  why?: string | null
  executable?: { number?: number }
}

/** Items waiting in the Jenkins build queue. */
export async function fetchQueue(): Promise<QueueItem[]> {
  const data = await get<{ items: RawQueueItem[] }>(
    `/queue/api/json?tree=items%5Bid,task%5Bname%5D,why,executable%5Bnumber%5D%5D`,
  )
  return (data.items ?? []).map((item) => ({
    id: item.id,
    name: item.task?.name ?? "(unknown)",
    why: item.why ?? null,
    buildNumber: item.executable?.number,
  }))
}

// Jenkins' plain API reports FAILURE; the pipeline stage API reports FAILED.
function normalizeStatus(raw: string | null | undefined): StageStatus {
  switch (raw) {
    case "SUCCESS":
      return "SUCCESS"
    case "FAILURE":
    case "FAILED":
      return "FAILURE"
    case "IN_PROGRESS":
    case "RUNNING":
      return "RUNNING"
    default:
      return "SKIPPED"
  }
}

type RawJob = { name: string; color?: string | null; _class: string; url?: string }
type RawView = { name: string }
type RawBuild = { number: number; result: string | null; timestamp: number; duration: number; building?: boolean }
type RawStage = { name: string; status: string; startTimeMillis: number; durationMillis: number }
type WfDescribe = { status: string; stages: RawStage[] }

// Jenkins job colors: blue=stable, red=failed, yellow=unstable, and a *_anime
// suffix means a build is running. Everything else (disabled, notbuilt,
// aborted, grey) is treated as inactive so the UI does not show a spinner.
export function jobStatus(color: string | null | undefined): StageStatus {
  if (!color) return "SKIPPED"
  if (color.endsWith("_anime")) return "RUNNING"
  if (color === "blue") return "SUCCESS"
  if (color === "red" || color === "yellow") return "FAILURE"
  return "SKIPPED"
}

// Jenkins reports an absolute URL (often with an internal host). We need the
// path after "/job/", and Jenkins expects the "/job/" separators kept when the
// job is nested in a folder: /job/A/job/B/ -> "A/job/B", so it re-joins as
// /job/A/job/B/... correctly.
function pathFromUrl(url: string | undefined, name: string): string {
  if (!url) return name
  const marker = "/job/"
  const start = url.indexOf(marker)
  if (start === -1) return name
  const rest = url.slice(start + marker.length).replace(/\/+$/, "")
  return rest || name
}

function toDeployment(build: RawBuild, commits: number): Deployment {
  const when = new Date(build.timestamp)
  const date = when.toLocaleDateString("en-US", { month: "short", day: "2-digit" })
  const time = when.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
  const status = build.building ? "RUNNING" : normalizeStatus(build.result)
  return {
    name: `#${build.number}`,
    status,
    number: build.number,
    date,
    time,
    commits,
    building: build.building ?? false,
  }
}

function stagesFromDescribe(describe: WfDescribe): Stage[] {
  return describe.stages.map((stage) => ({
    name: stage.name,
    durationMs: stage.durationMillis,
    status: normalizeStatus(stage.status),
    startedAt: new Date(stage.startTimeMillis).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
  }))
}

export type LogPage = {
  /** Raw text produced since the requested offset. */
  text: string
  /** New total size; pass back as `start` on the next poll. */
  size: number
  /** True while the build still has more output to produce. */
  more: boolean
}

// Jenkins' progressiveText returns everything from `start` onward, plus the new
// total in X-Text-Size and whether more is coming in X-More-Data.
export async function pollLog(jobPath: string, buildNumber: number, start: number): Promise<LogPage> {
  const profile = getActiveProfile()
  const res = await fetch(`${profile.url}/job/${jobPath}/${buildNumber}/logText/progressiveText?start=${start}`, {
    headers: { Authorization: authHeader() },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return { text: "", size: start, more: false }
  const text = await res.text()
  const size = Number.parseInt(res.headers.get("x-text-size") ?? "", 10)
  const more = (res.headers.get("x-more-data") ?? "").toLowerCase() !== "false"
  return { text, size: Number.isFinite(size) ? size : start + text.length, more }
}

type RawChangeSet = { commitCount?: number }
type WfChangesets = RawChangeSet[]

export async function fetchCommitCount(jobPath: string, buildNumber: number): Promise<number> {
  const sets = await get<WfChangesets>(`/job/${jobPath}/${buildNumber}/wfapi/changesets`)
  return sets.reduce((sum, set) => sum + (set.commitCount ?? 0), 0)
}

// Fetches commit counts for many builds a few at a time, so a long page does
// not fire hundreds of requests at once. Missing/failed builds count as 0.
export async function fetchCommitCounts(jobPath: string, buildNumbers: number[]): Promise<Map<number, number>> {
  const result = new Map<number, number>()
  const CONCURRENCY = 8
  for (let i = 0; i < buildNumbers.length; i += CONCURRENCY) {
    const batch = buildNumbers.slice(i, i + CONCURRENCY)
    const counts = await Promise.all(batch.map((n) => fetchCommitCount(jobPath, n).catch(() => 0)))
    batch.forEach((n, j) => result.set(n, counts[j] ?? 0))
  }
  return result
}

// Build history. Jenkins exposes no offset window for allBuilds (only a "first
// N"), so a page is simply the newest N builds. Growing N is how more history
// is loaded.
export async function fetchBuildPage(jobPath: string, limit = PAGE_SIZE): Promise<Deployment[]> {
  const data = await get<{ allBuilds: RawBuild[] }>(
    `/job/${jobPath}/api/json?tree=allBuilds%5Bnumber,result,timestamp,duration,building%5D%7B0,${limit}%7D`,
  )
  return (data.allBuilds ?? []).map((build) => toDeployment(build, 0))
}

export async function fetchStages(jobPath: string, buildNumber: number): Promise<Stage[]> {
  const describe = await get<WfDescribe>(`/job/${jobPath}/${buildNumber}/wfapi/describe`)
  return stagesFromDescribe(describe)
}

// The stage API only reveals stages that have already started, so a running
// build has no complete list. The most recent finished build of the same job
// provides the stage names as a template (status PENDING, duration 0).
export async function fetchStageTemplate(jobPath: string, excludeBuild: number): Promise<Stage[]> {
  const data = await get<{ builds: Array<{ number: number; building?: boolean }> }>(
    `/job/${jobPath}/api/json?tree=builds%5Bnumber,building%5D%7B0,${PAGE_SIZE}%7D`,
  )
  const previous = (data.builds ?? []).find((b) => !b.building && b.number !== excludeBuild)
  if (!previous) return []
  const stages = await fetchStages(jobPath, previous.number).catch(() => [] as Stage[])
  return stages.map((stage) => ({ name: stage.name, durationMs: 0, status: "PENDING" as const, startedAt: "" }))
}

// Lightweight liveness check used while streaming; avoids refetching the whole
// build list (which also pulls commit counts) on every poll tick.
export async function fetchBuildState(
  jobPath: string,
  buildNumber: number,
): Promise<{ building: boolean; result: StageStatus }> {
  const data = await get<{ building: boolean; result: string | null }>(
    `/job/${jobPath}/${buildNumber}/api/json?tree=building,result`,
  )
  return { building: data.building, result: normalizeStatus(data.result) }
}

function toProject(job: RawJob & { folder?: string }) {
  return {
    name: job.name,
    path: pathFromUrl(job.url, job.name),
    status: jobStatus(job.color),
    folder: job.folder,
  }
}

const isJob = (job: RawJob) => job._class.endsWith("WorkflowJob")
const isFolder = (job: RawJob) => job._class.endsWith("Folder")

// A view can list jobs directly (dev) or foldered jobs one level down (prod:
// view -> folder -> jobs). Expand folders so both shapes work, tagging each job
// with its folder so same-named jobs in different folders stay distinguishable.
async function expandViewJobs(entries: RawJob[]): Promise<Array<RawJob & { folder?: string }>> {
  const jobs: Array<RawJob & { folder?: string }> = []
  for (const entry of entries) {
    if (isJob(entry)) {
      jobs.push(entry)
      continue
    }
    if (isFolder(entry)) {
      const folderPath = pathFromUrl(entry.url, entry.name)
      const data = await get<{ jobs: RawJob[] }>(
        `/job/${folderPath}/api/json?tree=jobs%5Bname,color,_class,url%5D`,
      ).catch(() => ({ jobs: [] as RawJob[] }))
      for (const child of (data.jobs ?? []).filter(isJob)) {
        jobs.push({ ...child, folder: entry.name })
      }
    }
  }
  return jobs
}

// Jenkins views are the real organization axis (POLARIS, ALCOR, ...). Each view
// is fetched in parallel; jobs that no view lists are grouped under "other".
export async function fetchOrganizations(): Promise<Organization[]> {
  const views = await get<{ views: RawView[] }>(`/api/json?tree=views%5Bname%5D`)
  const names = (views.views ?? []).map((v) => v.name).filter((name) => name !== "all")
  console.debug(`[jenkins] views: ${names.length}`)

  const root = await get<{ jobs: RawJob[] }>(`/api/json?tree=jobs%5Bname,color,_class,url%5D`)
  const rootJobs = (root.jobs ?? []).filter(isJob)

  const perView = await Promise.all(
    names.map(async (name) => {
      const data = await get<{ jobs: RawJob[] }>(`/view/${encodeURIComponent(name)}/api/json?tree=jobs%5Bname,color,_class,url%5D`)
      const jobs = await expandViewJobs(data.jobs ?? [])
      return { name, jobs }
    }),
  )

  const organizations: Organization[] = perView
    .filter((v) => v.jobs.length > 0)
    .map((v) => ({ name: v.name, projects: v.jobs.map(toProject) }))

  console.debug(
    `[jenkins] orgs=${organizations.length} per-view: ${organizations.map((o) => `${o.name}:${o.projects.length}`).join(", ")}`,
  )

  // Jobs outside any view still show up, so nothing silently disappears.
  const covered = new Set(perView.flatMap((v) => v.jobs.map((j) => j.name)))
  const orphans = rootJobs.filter((job) => !covered.has(job.name))
  if (orphans.length > 0) organizations.push({ name: "other", projects: orphans.map(toProject) })

  return organizations
}
