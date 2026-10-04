import { describe, expect, test } from "bun:test"
import { resolveSelection } from "./resolve-selection"
import { initialState, type AppState } from "../state/store"
import type { Deployment, Organization } from "../types"

const orgs: Organization[] = [
  {
    name: "alcor",
    projects: [
      { name: "alcor-02", path: "alcor-02", status: "SUCCESS" },
      { name: "alcor-18", path: "alcor-18", status: "FAILURE" },
    ],
  },
  { name: "polaris", projects: [{ name: "polaris-08", path: "polaris-08", status: "SUCCESS" }] },
]

const builds: Deployment[] = [
  { name: "#35", status: "SUCCESS", number: 35, date: "Aug 19", time: "17:36", commits: 1, building: false },
  { name: "#33", status: "FAILURE", number: 33, date: "Aug 19", time: "16:35", commits: 0, building: false },
]

const deps = { "alcor-02": builds }

const state = (over: Partial<AppState> = {}): AppState => ({ ...initialState, ...over })

/** State override that sets the active level's query. */
const withQuery = (view: AppState["view"], text: string, over: Partial<AppState> = {}): AppState =>
  state({ ...over, view, queries: { org: "", project: "", deploy: "", run: "", [view]: text } })

describe("resolveSelection", () => {
  test("defaults to the first org when nothing is selected", () => {
    const s = resolveSelection(state(), orgs, {})
    expect(s.org?.name).toBe("alcor")
    expect(s.orgIndex).toBe(0)
  })

  test("resolves selection by identity, not position", () => {
    const s = resolveSelection(state({ selectedOrg: "polaris" }), orgs, {})
    expect(s.org?.name).toBe("polaris")
    expect(s.orgIndex).toBe(1)
  })

  test("filtering the active level keeps the parent context", () => {
    // Regression: searching "polaris" in deploy view used to change the org.
    const s = resolveSelection(
      withQuery("deploy", "polaris", { selectedOrg: "alcor", selectedProject: "alcor-02" }),
      orgs,
      deps,
    )
    expect(s.org?.name).toBe("alcor")
    expect(s.project?.name).toBe("alcor-02")
    expect(s.deployList).toHaveLength(0) // no build named "polaris"
  })

  test("filter at the org level narrows the list", () => {
    const s = resolveSelection(withQuery("org", "polar"), orgs, {})
    expect(s.orgList.map((o) => o.name)).toEqual(["polaris"])
    expect(s.org?.name).toBe("polaris")
  })

  test("a selected item missing from the filter falls back to the first hit", () => {
    const s = resolveSelection(withQuery("org", "polar", { selectedOrg: "alcor" }), orgs, {})
    expect(s.org?.name).toBe("polaris")
  })

  test("a mistyped query still resolves to the intended item", () => {
    const s = resolveSelection(withQuery("org", "poalris"), orgs, {})
    expect(s.orgList.map((o) => o.name)).toEqual(["polaris"])
  })

  test("resolves deployment by build number", () => {
    const s = resolveSelection(
      state({ view: "deploy", selectedOrg: "alcor", selectedProject: "alcor-02", selectedDeployment: 33 }),
      orgs,
      deps,
    )
    expect(s.deployment?.number).toBe(33)
    expect(s.deploymentIndex).toBe(1)
  })

  test("run view ignores the query for filtering (log search only)", () => {
    const s = resolveSelection(
      withQuery("run", "ERROR", { selectedOrg: "alcor", selectedProject: "alcor-02" }),
      orgs,
      deps,
    )
    expect(s.org?.name).toBe("alcor")
    expect(s.project?.name).toBe("alcor-02")
    expect(s.deployList).toHaveLength(2)
  })

  test("duplicate project names in different folders resolve by path", () => {
    // Regression: prod has the same job name under multiple folders, and a
    // name-based match jumped the selection back to the first occurrence.
    const dupOrgs: Organization[] = [
      {
        name: "POLARIS",
        projects: [
          { name: "api-biz", path: "POLARIS/job/api-biz", status: "SUCCESS", folder: "POLARIS" },
          { name: "check", path: "check", status: "SUCCESS" },
          { name: "api-biz", path: "POLARIS-CLOUD-GKE/job/api-biz", status: "FAILURE", folder: "POLARIS-CLOUD-GKE" },
        ],
      },
    ]
    const s = resolveSelection(
      state({ view: "project", selectedOrg: "POLARIS", selectedProject: "POLARIS-CLOUD-GKE/job/api-biz" }),
      dupOrgs,
      {},
    )
    expect(s.projectIndex).toBe(2)
    expect(s.project?.folder).toBe("POLARIS-CLOUD-GKE")
    expect(s.project?.status).toBe("FAILURE")
  })
})
