import type { BuildParam, BuildParamValue, Deployment, Organization, Stage, StageStatus } from "../types"
import { config, type Profile } from "../config"

export const PAGE_SIZE = config.pageSize

// Jenkins' plain API reports FAILURE; the pipeline stage API reports FAILED.
// ABORTED/UNSTABLE/PAUSED used to collapse into SKIPPED, which made aborted
// builds look "disabled" and paused pipelines look finished.
export function normalizeStatus(raw: string | null | undefined): StageStatus {
  switch (raw) {
    case "SUCCESS":
      return "SUCCESS"
    case "FAILURE":
    case "FAILED":
      return "FAILURE"
    case "IN_PROGRESS":
    case "RUNNING":
      return "RUNNING"
    case "ABORTED":
      return "ABORTED"
    case "UNSTABLE":
      return "UNSTABLE"
    case "PAUSED":
    case "PAUSED_PENDING_INPUT":
      return "PAUSED"
    case "SKIPPED":
    case "NOT_EXECUTED":
      return "SKIPPED"
    default:
      return "SKIPPED"
  }
}

export type RawJob = { name: string; color?: string | null; _class: string; url?: string }
type RawView = { name: string }
type RawBuild = { number: number; result: string | null; timestamp: number; duration: number; building?: boolean }
type RawStage = { name: string; status: string; startTimeMillis: number; durationMillis: number }
type WfDescribe = { status: string; stages: RawStage[] }
type RawChangeSet = { commitCount?: number }
type RawQueueItem = {
  id: number
  task?: { name?: string; url?: string }
  why?: string | null
  executable?: { number?: number }
}
type RawParamDef = {
  name?: string
  type?: string
  description?: string
  defaultParameterValue?: { value?: unknown }
  choices?: string[]
}

export type QueueItem = {
  id: number
  name: string
  path?: string
  why: string | null
  buildNumber?: number
}

/** Error carrying the HTTP status, so callers can distinguish 404 from transient failures. */
export class JenkinsError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = "JenkinsError"
  }
}

export type OrganizationTree = { organizations: Organization[]; partial: boolean }

export type LogPage = {
  /** Raw text produced since the requested offset. */
  text: string
  /** New total size; pass back as `start` on the next poll. */
  size: number
}

// Jenkins job colors: blue=stable, red=failed, yellow=unstable, and a *_anime
// suffix means a build is running. Everything else (disabled, notbuilt,
// aborted, grey) is treated as inactive so the UI does not show a spinner.
export function jobStatus(color: string | null | undefined): StageStatus {
  if (!color) return "SKIPPED"
  if (color.endsWith("_anime")) return "RUNNING"
  if (color === "blue") return "SUCCESS"
  if (color === "red") return "FAILURE"
  if (color === "yellow") return "UNSTABLE"
  if (color === "aborted") return "ABORTED"
  return "SKIPPED"
}

// Jenkins reports an absolute URL (often with an internal host). We need the
// path after "/job/", and Jenkins expects the "/job/" separators kept when the
// job is nested in a folder: /job/A/job/B/ -> "A/job/B", so it re-joins as
// /job/A/job/B/... correctly.
export function jobPathFromUrl(url: string | undefined, name: string): string {
  if (!url) return name
  const marker = "/job/"
  const start = url.indexOf(marker)
  if (start === -1) return name
  const rest = url.slice(start + marker.length).replace(/\/+$/, "")
  return rest || name
}

const JOB_CLASSES = ["WorkflowJob", "FreeStyleProject", "MatrixProject"]

// WorkflowJob covers single pipelines; multibranch and organization folders
// are containers whose children are jobs, so they expand like folders.
export const isJob = (job: RawJob): boolean => JOB_CLASSES.some((suffix) => job._class.endsWith(suffix))
export const isFolder = (job: RawJob): boolean => {
  const name = job._class
  return (
    name.endsWith("Folder") ||
    name.endsWith("WorkflowMultiBranchProject") ||
    name.endsWith("OrganizationFolder")
  )
}

const MAX_FOLDER_DEPTH = 6
const REQUEST_CONCURRENCY = 8

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

function paramValue(value: unknown): string {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

// A client is bound to one profile. Creating a new client on profile switch
// drops every cache, so no data can leak between servers.
export type JenkinsClient = {
  profile: Profile
  fetchOrganizations: () => Promise<OrganizationTree>
  fetchBuildPage: (jobPath: string, limit?: number) => Promise<Deployment[]>
  fetchCommitCounts: (
    jobPath: string,
    builds: Array<{ number: number; building?: boolean }>,
  ) => Promise<Map<number, number>>
  fetchStages: (jobPath: string, buildNumber: number) => Promise<Stage[]>
  fetchStageTemplate: (jobPath: string, excludeBuild: number) => Promise<Stage[]>
  fetchBuildState: (jobPath: string, buildNumber: number) => Promise<{ building: boolean; result: StageStatus }>
  pollLog: (jobPath: string, buildNumber: number, start: number) => Promise<LogPage>
  fetchQueue: () => Promise<QueueItem[]>
  fetchQueuedBuildNumber: (queueUrl: string) => Promise<number | undefined>
  fetchBuildParameters: (jobPath: string) => Promise<BuildParam[]>
  triggerBuild: (jobPath: string, params?: BuildParamValue[]) => Promise<string | undefined>
  stopBuild: (jobPath: string, buildNumber: number) => Promise<void>
  cancelQueueItem: (id: number) => Promise<void>
  jobUrl: (jobPath: string) => string
  buildConsoleUrl: (jobPath: string, buildNumber: number) => string
}

type FetchOptions = RequestInit & { tls?: { rejectUnauthorized?: boolean } }

export function createJenkinsClient(profile: Profile, fetchImpl: typeof fetch = fetch): JenkinsClient {
  const base = profile.url.replace(/\/+$/, "")
  const missingCredentials = (): never => {
    throw new Error(
      "Missing Jenkins credentials. Set them in ~/.config/jenkui/config.json (or JENKINS_USER/JENKINS_TOKEN).",
    )
  }
  const authHeader = (): string => {
    if (!profile.user || !profile.token) missingCredentials()
    return `Basic ${Buffer.from(`${profile.user}:${profile.token}`).toString("base64")}`
  }
  const absolute = (path: string): string => (path.startsWith("http") ? path : `${base}${path}`)

  function call(path: string, init: FetchOptions = {}): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: authHeader(),
      ...(init.headers as Record<string, string> | undefined),
    }
    const options: FetchOptions = {
      ...init,
      headers,
      signal: AbortSignal.timeout(15000),
    }
    if (profile.insecure) options.tls = { rejectUnauthorized: false }
    return fetchImpl(absolute(path), options)
  }

  async function get<T>(path: string, init: FetchOptions = {}): Promise<T> {
    const res = await call(path, {
      ...init,
      headers: { Accept: "application/json", ...(init.headers as Record<string, string> | undefined) },
    })
    if (!res.ok) throw new JenkinsError(res.status, `Jenkins ${res.status} ${res.statusText}: ${path}`)
    return (await res.json()) as T
  }

  // Write requests (trigger/stop/cancel). Jenkins answers 200/201/302 on success.
  async function post(path: string, body?: URLSearchParams): Promise<Response> {
    const res = await call(path, {
      method: "POST",
      ...(body
        ? {
            body: body.toString(),
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          }
        : {}),
    })
    if (!res.ok) throw new JenkinsError(res.status, `Jenkins ${res.status} ${res.statusText}: POST ${path}`)
    return res
  }

  // A view can list jobs directly (dev) or foldered jobs (prod: view -> folder
  // -> jobs). Folders and multibranch projects expand recursively, and each job
  // keeps its folder path so same-named jobs stay distinguishable. Requests are
  // batched so a view with many folders cannot flood Jenkins.
  type ExpandedJobs = { jobs: Array<RawJob & { folder?: string }>; partial: boolean }

  async function expandEntries(
    entries: RawJob[],
    folder: string | undefined,
    depth: number,
  ): Promise<ExpandedJobs> {
    const jobs: Array<RawJob & { folder?: string }> = []
    let partial = false
    for (let i = 0; i < entries.length; i += REQUEST_CONCURRENCY) {
      const batch = entries.slice(i, i + REQUEST_CONCURRENCY)
      const results = await Promise.all(
        batch.map(async (entry): Promise<ExpandedJobs> => {
          if (isJob(entry)) return { jobs: [{ ...entry, folder }], partial: false }
          if (!isFolder(entry) || depth >= MAX_FOLDER_DEPTH) return { jobs: [], partial: false }
          const folderPath = jobPathFromUrl(entry.url, entry.name)
          const nextFolder = folder ? `${folder}/${entry.name}` : entry.name
          const data = await get<{ jobs?: RawJob[] }>(
            `/job/${folderPath}/api/json?tree=jobs%5Bname,color,_class,url%5D`,
          ).catch(() => null)
          if (data === null) return { jobs: [], partial: true }
          return expandEntries(data.jobs ?? [], nextFolder, depth + 1)
        }),
      )
      for (const result of results) {
        jobs.push(...result.jobs)
        partial ||= result.partial
      }
    }
    return { jobs, partial }
  }

  const commitCache = new Map<string, number>()
  const COMMIT_CACHE_LIMIT = 5000

  function rememberCommit(key: string, count: number): void {
    if (commitCache.size >= COMMIT_CACHE_LIMIT) {
      const oldest = commitCache.keys().next().value
      if (oldest !== undefined) commitCache.delete(oldest)
    }
    commitCache.set(key, count)
  }

  async function fetchCommitCount(jobPath: string, buildNumber: number, refresh: boolean): Promise<number> {
    const key = `${jobPath}#${buildNumber}`
    if (!refresh) {
      const cached = commitCache.get(key)
      if (cached !== undefined) return cached
    }
    const sets = await get<RawChangeSet[]>(`/job/${jobPath}/${buildNumber}/wfapi/changesets`).catch((err) => {
      // Freestyle jobs have no workflow API. Remember that permanently instead
      // of firing the same 404 for every build on every refresh. Running builds
      // are not cached: a pipeline may expose changesets only after checkout.
      if (!refresh && err instanceof JenkinsError && err.status === 404) rememberCommit(key, 0)
      return null
    })
    // Do not cache a transient failure as "0 commits".
    if (sets === null) return 0
    const count = sets.reduce((sum, set) => sum + (set.commitCount ?? 0), 0)
    // Only cache finished builds. A running build's count can still grow, and
    // the next call with building=false will fetch the final number once.
    if (!refresh) rememberCommit(key, count)
    return count
  }

  async function fetchCommitCounts(
    jobPath: string,
    builds: Array<{ number: number; building?: boolean }>,
  ): Promise<Map<number, number>> {
    const result = new Map<number, number>()
    const pending: Array<{ number: number; refresh: boolean }> = []
    for (const build of builds) {
      // A running build's changeset can still grow, so never serve it from cache.
      const cached = commitCache.get(`${jobPath}#${build.number}`)
      if (cached !== undefined && !build.building) result.set(build.number, cached)
      else pending.push({ number: build.number, refresh: Boolean(build.building) })
    }
    const CONCURRENCY = REQUEST_CONCURRENCY
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const batch = pending.slice(i, i + CONCURRENCY)
      const counts = await Promise.all(
        batch.map((build) => fetchCommitCount(jobPath, build.number, build.refresh)),
      )
      batch.forEach((build, index) => {
        result.set(build.number, counts[index] ?? 0)
      })
    }
    return result
  }

  async function fetchStages(jobPath: string, buildNumber: number): Promise<Stage[]> {
    const describe = await get<WfDescribe>(`/job/${jobPath}/${buildNumber}/wfapi/describe`)
    return stagesFromDescribe(describe)
  }

  return {
    profile,

    async fetchOrganizations(): Promise<OrganizationTree> {
      const views = await get<{ views: RawView[] }>(`/api/json?tree=views%5Bname%5D`)
      const names = (views.views ?? [])
        .map((view) => view.name)
        .filter((name) => name.toLowerCase() !== "all")
      console.debug(`[jenkins] views: ${names.length}`)

      const [root, perView] = await Promise.all([
        get<{ jobs?: RawJob[] }>(`/api/json?tree=jobs%5Bname,color,_class,url%5D`)
          .then((data) => expandEntries(data.jobs ?? [], undefined, 0))
          .catch(() => ({ jobs: [], partial: true }) as ExpandedJobs),
        Promise.all(
          names.map(async (name) => {
            const data = await get<{ jobs?: RawJob[] }>(
              `/view/${encodeURIComponent(name)}/api/json?tree=jobs%5Bname,color,_class,url%5D`,
            ).catch(() => null)
            if (data === null) return { name, jobs: [], partial: true, failed: true }
            const expanded = await expandEntries(data.jobs ?? [], undefined, 0)
            return { name, ...expanded, failed: false }
          }),
        ),
      ])

      // If every view failed, this is an outage, not an empty Jenkins. Throw so
      // the caller keeps its previous tree instead of showing only "other".
      if (names.length > 0 && perView.every((view) => view.failed)) {
        throw new Error("Could not load any Jenkins view")
      }

      const organizations: Organization[] = perView
        .filter((view) => view.jobs.length > 0)
        .map((view) => ({
          name: view.name,
          projects: view.jobs.map((job) => ({
            name: job.name,
            path: jobPathFromUrl(job.url, job.name),
            status: jobStatus(job.color),
            folder: job.folder,
          })),
        }))

      console.debug(
        `[jenkins] orgs=${organizations.length} per-view: ${organizations
          .map((org) => `${org.name}:${org.projects.length}`)
          .join(", ")}`,
      )

      // Compare by path, not name: a root job called "deploy" is not the same
      // job as a view job called "deploy" in a folder.
      const covered = new Set(
        perView.flatMap((view) => view.jobs.map((job) => jobPathFromUrl(job.url, job.name))),
      )
      const orphans = root.jobs.filter((job) => !covered.has(jobPathFromUrl(job.url, job.name)))
      if (orphans.length > 0) {
        organizations.push({
          name: "other",
          projects: orphans.map((job) => ({
            name: job.name,
            path: jobPathFromUrl(job.url, job.name),
            status: jobStatus(job.color),
            folder: job.folder,
          })),
        })
      }

      const partial = root.partial || perView.some((view) => view.partial)
      return { organizations, partial }
    },

    async fetchBuildPage(jobPath: string, limit = PAGE_SIZE): Promise<Deployment[]> {
      // Jenkins exposes no offset window for allBuilds (only a "first N"), so a
      // page is simply the newest N builds. Growing N is how more history loads.
      const data = await get<{ allBuilds?: RawBuild[] }>(
        `/job/${jobPath}/api/json?tree=allBuilds%5Bnumber,result,timestamp,duration,building%5D%7B0,${limit}%7D`,
      )
      return (data.allBuilds ?? []).map((build) => toDeployment(build, 0))
    },

    fetchCommitCounts,

    fetchStages,

    // The stage API only reveals stages that have already started, so a running
    // build has no complete list. The most recent finished build of the same job
    // provides the stage names as a template (status PENDING, duration 0) plus
    // the durations used to estimate progress while the new build runs.
    async fetchStageTemplate(jobPath: string, excludeBuild: number): Promise<Stage[]> {
      const data = await get<{ builds?: Array<{ number: number; building?: boolean }> }>(
        `/job/${jobPath}/api/json?tree=builds%5Bnumber,building%5D%7B0,${PAGE_SIZE}%7D`,
      )
      const previous = (data.builds ?? []).find((build) => !build.building && build.number !== excludeBuild)
      if (!previous) return []
      const stages = await fetchStages(jobPath, previous.number).catch(() => [] as Stage[])
      return stages.map((stage) => ({
        name: stage.name,
        durationMs: 0,
        status: "PENDING" as const,
        startedAt: "",
        // Only a stage that finished successfully gives a usable estimate;
        // aborted or failed stages stopped early.
        estimateMs: stage.status === "SUCCESS" && stage.durationMs > 0 ? stage.durationMs : undefined,
      }))
    },

    // Lightweight liveness check used while streaming; avoids refetching the whole
    // build list (which also pulls commit counts) on every poll tick.
    async fetchBuildState(
      jobPath: string,
      buildNumber: number,
    ): Promise<{ building: boolean; result: StageStatus }> {
      const data = await get<{ building?: boolean; result: string | null }>(
        `/job/${jobPath}/${buildNumber}/api/json?tree=building,result`,
      )
      return { building: Boolean(data.building), result: normalizeStatus(data.result) }
    },

    // Jenkins' progressiveText returns everything from `start` onward, plus the
    // new total in X-Text-Size. Unlike the old version this throws on a failed
    // request so the caller can retry instead of silently ending the stream.
    async pollLog(jobPath: string, buildNumber: number, start: number): Promise<LogPage> {
      const res = await call(`/job/${jobPath}/${buildNumber}/logText/progressiveText?start=${start}`)
      if (!res.ok) throw new Error(`Jenkins ${res.status} ${res.statusText}: progressiveText`)
      const text = await res.text()
      const size = Number.parseInt(res.headers.get("x-text-size") ?? "", 10)
      return { text, size: Number.isFinite(size) ? size : start + text.length }
    },

    async fetchQueue(): Promise<QueueItem[]> {
      const data = await get<{ items?: RawQueueItem[] }>(
        `/queue/api/json?tree=items%5Bid,task%5Bname,url%5D,why,executable%5Bnumber%5D%5D`,
      )
      return (data.items ?? []).map((item) => ({
        id: item.id,
        name: item.task?.name ?? "(unknown)",
        path: item.task?.url ? jobPathFromUrl(item.task.url, item.task.name ?? "") : undefined,
        why: item.why ?? null,
        buildNumber: item.executable?.number,
      }))
    },

    async fetchQueuedBuildNumber(queueUrl: string): Promise<number | undefined> {
      // Jenkins often advertises an absolute URL with an internal hostname.
      // Prefer the /queue/... path so it goes through the profile's base URL.
      const marker = queueUrl.indexOf("/queue/")
      const target = marker >= 0 ? queueUrl.slice(marker) : queueUrl
      const data = await get<{ executable?: { number?: number } }>(
        `${target.replace(/\/+$/, "")}/api/json?tree=executable%5Bnumber%5D`,
      ).catch(() => ({ executable: undefined }))
      return data.executable?.number
    },

    async fetchBuildParameters(jobPath: string): Promise<BuildParam[]> {
      const data = await get<{ property?: Array<{ parameterDefinitions?: RawParamDef[] }> }>(
        `/job/${jobPath}/api/json?tree=property%5BparameterDefinitions%5Bname,type,description,defaultParameterValue%5Bvalue%5D,choices%5D%5D`,
      )
      const definitions = (data.property ?? []).flatMap((property) => property.parameterDefinitions ?? [])
      return definitions
        .filter((definition) => definition.name)
        .map((definition) => ({
          name: definition.name!,
          type: definition.type ?? "StringParameterDefinition",
          description: definition.description || undefined,
          // Password defaults are encrypted hashes, not usable values.
          defaultValue: definition.type?.includes("Password")
            ? ""
            : paramValue(definition.defaultParameterValue?.value),
          choices: Array.isArray(definition.choices) ? definition.choices : undefined,
        }))
    },

    async triggerBuild(jobPath: string, params: BuildParamValue[] = []): Promise<string | undefined> {
      // delay=0sec skips the default quiet period, matching the web "Build Now".
      // buildWithParameters carries the values in a form body, not the URL:
      // Jenkins access logs and proxy logs must not contain password parameters.
      if (params.length > 0) {
        const body = new URLSearchParams()
        for (const param of params) body.set(param.name, param.value)
        body.set("delay", "0sec")
        const res = await post(`/job/${jobPath}/buildWithParameters`, body)
        return res.headers.get("location") ?? undefined
      }
      const res = await post(`/job/${jobPath}/build?delay=0sec`)
      return res.headers.get("location") ?? undefined
    },

    async stopBuild(jobPath: string, buildNumber: number): Promise<void> {
      await post(`/job/${jobPath}/${buildNumber}/stop`)
    },

    async cancelQueueItem(id: number): Promise<void> {
      await post(`/queue/cancelItem?id=${id}`)
    },

    jobUrl(jobPath: string): string {
      return `${base}/job/${jobPath}/`
    },

    buildConsoleUrl(jobPath: string, buildNumber: number): string {
      return `${base}/job/${jobPath}/${buildNumber}/console`
    },
  }
}
