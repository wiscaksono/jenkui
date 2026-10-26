import { describe, expect, test } from "bun:test"
import { titleFor } from "./views"

describe("titleFor", () => {
  test("list views name the scope the user is browsing", () => {
    expect(titleFor({ view: "org" })).toBe("jenkui | organizations")
    expect(titleFor({ view: "project", orgName: "SINARMAS" })).toBe("jenkui | SINARMAS")
    expect(titleFor({ view: "deploy", orgName: "SINARMAS", projectName: "web-polaris-ts" })).toBe(
      "jenkui | SINARMAS \u203a web-polaris-ts",
    )
  })

  test("the run view carries the build and its state", () => {
    expect(
      titleFor({
        view: "run",
        projectName: "web-polaris-ts",
        deploymentName: "#1234",
        status: "RUNNING",
        live: true,
      }),
    ).toBe("jenkui | web-polaris-ts #1234 RUNNING \u00b7 live")
    expect(
      titleFor({ view: "run", projectName: "web-polaris-ts", deploymentName: "#1234", status: "FAILURE" }),
    ).toBe("jenkui | web-polaris-ts #1234 FAILURE")
  })

  test("the profile is only worth naming when there is a choice", () => {
    const base = { view: "project" as const, orgName: "SINARMAS", profile: "work" }
    expect(titleFor({ ...base, profileCount: 1 })).toBe("jenkui | SINARMAS")
    expect(titleFor({ ...base, profileCount: 3 })).toBe("jenkui | SINARMAS \u00b7 work")
  })

  test("missing data falls back to the level being loaded", () => {
    expect(titleFor({ view: "project" })).toBe("jenkui | projects")
    expect(titleFor({ view: "deploy" })).toBe("jenkui | builds")
    expect(titleFor({ view: "run" })).toBe("jenkui | build")
  })
})
