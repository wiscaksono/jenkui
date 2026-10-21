import { describe, expect, test } from "bun:test"
import { initialState, reducer, type AppState } from "./store"

const state = (over: Partial<AppState> = {}): AppState => ({ ...initialState, ...over })

describe("reducer", () => {
  test("drillIn moves one level at a time", () => {
    let s = initialState
    s = reducer(s, { type: "drillIn" })
    expect(s.view).toBe("project")
    s = reducer(s, { type: "drillIn" })
    expect(s.view).toBe("deploy")
    s = reducer(s, { type: "drillIn" })
    expect(s.view).toBe("run")
    // No further level; another drill is a no-op.
    expect(reducer(s, { type: "drillIn" }).view).toBe("run")
  })

  test("goBack stops at the top level", () => {
    expect(reducer(initialState, { type: "goBack" }).view).toBe("org")
    let s = reducer(initialState, { type: "drillIn" })
    s = reducer(s, { type: "goBack" })
    expect(s.view).toBe("org")
  })

  test("drillIn keeps each level's query (persistent search)", () => {
    const s = reducer(state({ queries: { org: "polaris", project: "", deploy: "", run: "" } }), { type: "drillIn" })
    expect(s.view).toBe("project")
    expect(s.queries.org).toBe("polaris")
  })

  test("selecting an org clears the deeper selection", () => {
    const s = reducer(
      state({ selectedOrg: "alcor", selectedProject: "alcor-02", selectedDeployment: 35 }),
      { type: "selectOrg", name: "polaris" },
    )
    expect(s.selectedOrg).toBe("polaris")
    expect(s.selectedProject).toBeNull()
    expect(s.selectedDeployment).toBeNull()
  })

  test("setQuery writes to the active level only", () => {
    // Regression: typing at a deeper level used to reset the org selection.
    const s = reducer(state({ selectedOrg: "alcor", view: "org" }), { type: "setQuery", query: "polaris" })
    expect(s.selectedOrg).toBe("alcor")
    expect(s.queries.org).toBe("polaris")
    expect(s.queries.project).toBe("")
  })

  test("clearQuery empties only the active level", () => {
    const s = reducer(
      state({ view: "deploy", queries: { org: "a", project: "b", deploy: "c", run: "d" } }),
      { type: "clearQuery" },
    )
    expect(s.queries).toEqual({ org: "a", project: "b", deploy: "", run: "d" })
  })

  test("resetForProfile clears all selection and queries", () => {
    // Regression: after a profile switch the old server's selection and view
    // stuck around, so the new server's data was filtered by a stale context.
    const s = reducer(
      state({
        view: "deploy",
        selectedOrg: "POLARIS",
        selectedProject: "polaris-x",
        selectedDeployment: 91,
        queries: { org: "a", project: "b", deploy: "c", run: "d" },
      }),
      { type: "resetForProfile" },
    )
    expect(s.view).toBe("org")
    expect(s.selectedOrg).toBeNull()
    expect(s.selectedProject).toBeNull()
    expect(s.selectedDeployment).toBeNull()
    expect(s.queries).toEqual({ org: "", project: "", deploy: "", run: "" })
  })

  test("cycleFilter loops through the status filters", () => {
    let s = initialState
    const seen: string[] = []
    for (let i = 0; i < 4; i++) {
      s = reducer(s, { type: "cycleFilter" })
      seen.push(s.statusFilter)
    }
    expect(seen).toEqual(["failed", "running", "success", "all"])
  })

  test("toggleAutoRefresh flips the flag", () => {
    expect(reducer(initialState, { type: "toggleAutoRefresh" }).autoRefresh).toBe(false)
    expect(reducer(state({ autoRefresh: false }), { type: "toggleAutoRefresh" }).autoRefresh).toBe(true)
  })

  test("askConfirm and clearConfirm manage the pending write", () => {
    const action = {
      kind: "build" as const,
      label: "Build x?",
      profile: "dev",
      url: "http://x",
      projectPath: "x",
    }
    const asked = reducer(initialState, { type: "askConfirm", action })
    expect(asked.confirm).toEqual(action)
    expect(reducer(asked, { type: "clearConfirm" }).confirm).toBeNull()
  })

  test("openBuild jumps straight to a build and closes the queue", () => {
    const s = reducer(state({ queueOpen: true, view: "org" }), {
      type: "openBuild",
      org: "polaris",
      projectPath: "polaris/job/api",
      buildNumber: 42,
    })
    expect(s.view).toBe("run")
    expect(s.selectedOrg).toBe("polaris")
    expect(s.selectedProject).toBe("polaris/job/api")
    expect(s.selectedDeployment).toBe(42)
    expect(s.queueOpen).toBe(false)
  })

  test("parameter form edits one field at a time and advances on commit", () => {
    const fields = [
      { name: "BRANCH", type: "StringParameterDefinition", defaultValue: "main", value: "main" },
      { name: "DRY_RUN", type: "BooleanParameterDefinition", defaultValue: "false", value: "false" },
    ]
    let s = reducer(initialState, {
      type: "openParams",
      projectPath: "app",
      projectName: "app",
      fields,
    })
    s = reducer(s, { type: "setParamEditing", editing: true })
    s = reducer(s, { type: "setParamValue", value: "release" })
    s = reducer(s, { type: "commitParam" })
    expect(s.params?.fields[0]?.value).toBe("release")
    expect(s.params?.fields[1]?.value).toBe("false")
    expect(s.params?.index).toBe(1)
    expect(s.params?.editing).toBe(false)

    s = reducer(s, { type: "moveParam", delta: -1, count: 2 })
    expect(s.params?.index).toBe(0)
    s = reducer(s, { type: "closeParams" })
    expect(s.params).toBeNull()
  })

  test("a profile switch drops an open parameter form and notice", () => {
    const s = reducer(
      state({
        notice: { text: "build queued", tone: "info" },
        params: {
          projectPath: "app",
          projectName: "app",
          fields: [],
          index: 0,
          editing: false,
        },
      }),
      { type: "resetForProfile" },
    )
    expect(s.params).toBeNull()
    expect(s.notice).toBeNull()
  })
})
