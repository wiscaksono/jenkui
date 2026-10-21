import { afterEach, describe, expect, test } from "bun:test"
import { createJenkinsClient, jobPathFromUrl, normalizeStatus, type RawJob } from "./jenkins"

type Server = { url: string; stop: () => void; hits: string[] }

function startServer(handler: (request: Request, url: URL) => Response | Promise<Response>): Server {
  const hits: string[] = []
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url)
      hits.push(`${request.method} ${url.pathname}${url.search}`)
      return handler(request, url)
    },
  })
  return {
    url: `http://127.0.0.1:${server.port}`,
    stop: () => server.stop(true),
    hits,
  }
}

const servers: Server[] = []
afterEach(() => {
  while (servers.length > 0) servers.pop()!.stop()
  failBrokenView = false
  lastBuildBody = ""
})

function clientFor(server: Server, insecure = false) {
  return createJenkinsClient({
    url: server.url,
    user: "u",
    token: "t",
    insecure,
  })
}

const job = (name: string, _class: string, path: string): RawJob => ({
  name,
  _class,
  color: "blue",
  url: `/job/${path}/`,
})

const WORKFLOW = "org.jenkinsci.plugins.workflow.job.WorkflowJob"
const FREESTYLE = "hudson.model.FreeStyleProject"
const FOLDER = "com.cloudbees.hudson.plugins.folder.Folder"
const MULTIBRANCH = "org.jenkinsci.plugins.workflow.multibranch.WorkflowMultiBranchProject"

const api = job("api", WORKFLOW, "api")
const team = job("team", FOLDER, "team")
const nested = job("nested", FOLDER, "team/job/nested")
const teamApi = job("api", WORKFLOW, "team/job/api")
const legacy = job("legacy", FREESTYLE, "team/job/nested/job/legacy")
const branchProject = job("mb", MULTIBRANCH, "mb")
const branch = job("main", WORKFLOW, "mb/job/main")
const orphan = job("orphan", FREESTYLE, "orphan")
const rootFolder = job("root", FOLDER, "root")
const rootChild = job("child", WORKFLOW, "root/job/child")

const children: Record<string, RawJob[]> = {
  "": [api, team, branchProject, orphan, rootFolder],
  team: [teamApi, nested],
  "team/job/nested": [legacy],
  mb: [branch],
  root: [rootChild],
}

const viewJobs: Record<string, RawJob[]> = {
  POLARIS: [api, team, branchProject],
}

let failBrokenView = false
let lastBuildBody = ""

const builds = [
  {
    number: 101,
    building: false,
    result: "SUCCESS",
    timestamp: Date.UTC(2026, 0, 1),
    duration: 1200,
  },
  {
    number: 100,
    building: true,
    result: null,
    timestamp: Date.UTC(2026, 0, 1),
    duration: 0,
  },
]

const params = [
  {
    name: "BRANCH",
    type: "StringParameterDefinition",
    description: "Git branch",
    defaultParameterValue: { value: "main" },
  },
  {
    name: "TARGET",
    type: "ChoiceParameterDefinition",
    defaultParameterValue: { value: "dev" },
    choices: ["dev", "prod"],
  },
]

async function jenkinsHandler(request: Request, url: URL): Promise<Response> {
  const path = url.pathname
  const tree = url.searchParams.get("tree") ?? ""
  const headers = { "content-type": "application/json" }

  if (path === "/api/json" && tree.includes("views")) {
    return Response.json({ views: [{ name: "POLARIS" }, { name: "BROKEN" }, { name: "all" }] }, { headers })
  }
  if (path === "/api/json" && tree.includes("jobs")) {
    return Response.json({ jobs: children[""] }, { headers })
  }
  if (path === "/view/POLARIS/api/json") {
    return Response.json({ jobs: viewJobs.POLARIS }, { headers })
  }
  if (path === "/view/BROKEN/api/json") {
    if (failBrokenView) return new Response("view failed", { status: 500 })
    return Response.json({ jobs: [] }, { headers })
  }
  if (path === "/queue/api/json") {
    return Response.json(
      {
        items: [
          {
            id: 7,
            task: { name: "api", url: "/job/api/" },
            why: "Waiting for next available executor",
            executable: { number: 102 },
          },
        ],
      },
      { headers },
    )
  }
  if (path === "/queue/item/7/api/json") {
    return Response.json({ executable: { number: 42 } }, { headers })
  }
  if (path === "/queue/cancelItem") {
    return new Response(null, { status: 200 })
  }

  const jobMatch = path.match(/^\/job\/(.+?)(?:\/(\d+))?\/(api\/json|wfapi\/describe|wfapi\/changesets|logText\/progressiveText|build|buildWithParameters|stop)$/)
  if (jobMatch) {
    const jobPath = jobMatch[1]!
    const buildNumber = jobMatch[2] ? Number(jobMatch[2]) : undefined
    const endpoint = jobMatch[3]!

    if (endpoint === "api/json") {
      if (tree.includes("allBuilds")) return Response.json({ allBuilds: builds }, { headers })
      if (tree.includes("property")) return Response.json({ property: [{ parameterDefinitions: params }] }, { headers })
      if (tree.includes("building")) {
        const build = builds.find((entry) => entry.number === buildNumber)
        return Response.json({ building: build?.building ?? false, result: build?.result ?? null }, { headers })
      }
      if (tree.includes("builds")) return Response.json({ builds }, { headers })
      return Response.json({ jobs: children[jobPath] ?? [] }, { headers })
    }

    if (endpoint === "wfapi/describe" && buildNumber !== undefined) {
      return Response.json(
        {
          status: "FAILED",
          stages: [
            { name: "Checkout", status: "SUCCESS", startTimeMillis: 0, durationMillis: 1000 },
            { name: "Deploy", status: "FAILURE", startTimeMillis: 1000, durationMillis: 2000 },
          ],
        },
        { headers },
      )
    }
    if (endpoint === "wfapi/changesets") {
      if (jobPath === "freestyle") return new Response("no workflow api", { status: 404 })
      return Response.json([{ commitCount: buildNumber === 101 ? 3 : 1 }], { headers })
    }
    if (endpoint === "logText/progressiveText") {
      const start = Number(url.searchParams.get("start") ?? "0")
      const text = start === 0 ? "hello\n" : ""
      return new Response(text, {
        status: 200,
        headers: { "x-text-size": String(start + text.length) },
      })
    }
    if (endpoint === "buildWithParameters") {
      lastBuildBody = await request.text()
      return new Response(null, { status: 201, headers: { location: "/queue/item/7/" } })
    }
    if (endpoint === "build") {
      return new Response(null, { status: 201, headers: { location: "/queue/item/7/" } })
    }
    if (endpoint === "stop") {
      return new Response(null, { status: 200 })
    }
  }

  return new Response(`unhandled ${request.method} ${path}${url.search}`, { status: 404 })
}

describe("createJenkinsClient", () => {
  test("expands views, nested folders, multibranch projects, and path-keyed orphans", async () => {
    const server = startServer(jenkinsHandler)
    servers.push(server)
    const client = clientFor(server)
    const { organizations, partial } = await client.fetchOrganizations()
    expect(partial).toBe(false)

    expect(organizations.map((org) => org.name)).toEqual(["POLARIS", "other"])

    const polaris = organizations[0]!
    expect(polaris.projects.map((project) => project.path)).toEqual([
      "api",
      "team/job/api",
      "team/job/nested/job/legacy",
      "mb/job/main",
    ])
    expect(polaris.projects.find((project) => project.path === "team/job/api")?.folder).toBe("team")
    expect(polaris.projects.find((project) => project.path === "team/job/nested/job/legacy")?.folder).toBe(
      "team/nested",
    )
    expect(polaris.projects.find((project) => project.path === "mb/job/main")?.folder).toBe("mb")

    const other = organizations[1]!
    expect(other.projects.map((project) => project.path)).toEqual(["orphan", "root/job/child"])
    // A root job whose path is covered by a view must not reappear as an orphan.
    expect(other.projects.some((project) => project.path === "api")).toBe(false)
    // The synthetic "all" view is skipped.
    expect(server.hits.some((hit) => hit.includes("/view/all/"))).toBe(false)
  })

  test("marks the tree partial when a view fails instead of dropping it silently", async () => {
    const server = startServer(jenkinsHandler)
    servers.push(server)
    const client = clientFor(server)
    failBrokenView = true

    const { organizations, partial } = await client.fetchOrganizations()
    expect(partial).toBe(true)
    expect(organizations.map((org) => org.name)).toEqual(["POLARIS", "other"])
  })

  test("caches finished commit counts but refreshes running builds", async () => {
    const server = startServer(jenkinsHandler)
    servers.push(server)
    const client = clientFor(server)
    const page = await client.fetchBuildPage("api", 10)
    expect(page.map((build) => build.number)).toEqual([101, 100])
    expect(page[0]?.status).toBe("SUCCESS")
    expect(page[1]?.status).toBe("RUNNING")

    const first = await client.fetchCommitCounts("api", page)
    const second = await client.fetchCommitCounts("api", page)
    expect(first.get(101)).toBe(3)
    expect(second.get(101)).toBe(3)

    const changesetHits = (number: number) =>
      server.hits.filter((hit) => hit.includes(`/api/${number}/wfapi/changesets`)).length
    expect(changesetHits(101)).toBe(1)
    expect(changesetHits(100)).toBe(2)

    // Freestyle jobs have no workflow API. The 404 is cached, so a second
    // refresh does not repeat the request.
    const freestyleBuild = [{ number: 101, building: false }]
    await client.fetchCommitCounts("freestyle", freestyleBuild)
    await client.fetchCommitCounts("freestyle", freestyleBuild)
    expect(
      server.hits.filter((hit) => hit.includes("/job/freestyle/101/wfapi/changesets")).length,
    ).toBe(1)
  })

  test("streams progressive text and reports the new offset", async () => {
    const server = startServer(jenkinsHandler)
    servers.push(server)
    const client = clientFor(server)
    const first = await client.pollLog("api", 101, 0)
    expect(first.text).toBe("hello\n")
    expect(first.size).toBe(6)
    const second = await client.pollLog("api", 101, first.size)
    expect(second.text).toBe("")
    expect(second.size).toBe(6)
  })

  test("follows trigger Location, forwards parameters, stops and cancels", async () => {
    const server = startServer(jenkinsHandler)
    servers.push(server)
    const client = clientFor(server)

    const location = await client.triggerBuild("api", [{ name: "BRANCH", value: "release/x" }])
    expect(location).toBe("/queue/item/7/")
    expect(lastBuildBody).toContain("BRANCH=release%2Fx")
    expect(lastBuildBody).toContain("delay=0sec")
    // Secrets in parameter values must not end up in the URL (and its logs).
    expect(server.hits).toContain("POST /job/api/buildWithParameters")
    expect(server.hits.some((hit) => hit.includes("BRANCH="))).toBe(false)

    expect(await client.fetchQueuedBuildNumber(location!)).toBe(42)
    // A proxied Jenkins may advertise its internal hostname; the queue path
    // must still go through the profile URL.
    expect(await client.fetchQueuedBuildNumber("http://jenkins.internal/queue/item/7/")).toBe(42)
    await client.stopBuild("api", 101)
    await client.cancelQueueItem(7)
    expect(server.hits).toContain("POST /job/api/101/stop")
    expect(server.hits).toContain("POST /queue/cancelItem?id=7")

    const plain = await client.triggerBuild("api")
    expect(plain).toBe("/queue/item/7/")
    expect(server.hits.some((hit) => hit.includes("/job/api/build?delay=0sec"))).toBe(true)
  })

  test("reads queue items, parameters and stage descriptions", async () => {
    const server = startServer(jenkinsHandler)
    servers.push(server)
    const client = clientFor(server)

    const queue = await client.fetchQueue()
    expect(queue).toEqual([
      {
        id: 7,
        name: "api",
        path: "api",
        why: "Waiting for next available executor",
        buildNumber: 102,
      },
    ])

    const definitions = await client.fetchBuildParameters("api")
    expect(definitions).toEqual([
      {
        name: "BRANCH",
        type: "StringParameterDefinition",
        description: "Git branch",
        defaultValue: "main",
        choices: undefined,
      },
      {
        name: "TARGET",
        type: "ChoiceParameterDefinition",
        description: undefined,
        defaultValue: "dev",
        choices: ["dev", "prod"],
      },
    ])

    const stages = await client.fetchStages("api", 101)
    expect(stages.map((stage) => [stage.name, stage.status])).toEqual([
      ["Checkout", "SUCCESS"],
      ["Deploy", "FAILURE"],
    ])
  })

  test("throws on HTTP errors instead of ending the stream silently", async () => {
    const server = startServer(() => new Response("nope", { status: 500 }))
    servers.push(server)
    const client = clientFor(server)
    await expect(client.pollLog("api", 101, 0)).rejects.toThrow("Jenkins 500")
  })
})

describe("status helpers", () => {
  test("maps pipeline-only statuses instead of collapsing them to skipped", () => {
    expect(normalizeStatus("ABORTED")).toBe("ABORTED")
    expect(normalizeStatus("UNSTABLE")).toBe("UNSTABLE")
    expect(normalizeStatus("PAUSED_PENDING_INPUT")).toBe("PAUSED")
    expect(normalizeStatus("NOT_EXECUTED")).toBe("SKIPPED")
    expect(normalizeStatus("FAILED")).toBe("FAILURE")
  })

  test("keeps the /job/ separators in nested job paths", () => {
    expect(jobPathFromUrl("http://ci/job/A/job/B/", "B")).toBe("A/job/B")
    expect(jobPathFromUrl(undefined, "plain")).toBe("plain")
  })
})
