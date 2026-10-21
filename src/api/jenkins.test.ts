import { describe, expect, test } from "bun:test"
import { jobStatus } from "./jenkins"

describe("jobStatus", () => {
  test("running only when the color has the _anime suffix", () => {
    expect(jobStatus("blue_anime")).toBe("RUNNING")
    expect(jobStatus("red_anime")).toBe("RUNNING")
    expect(jobStatus("yellow_anime")).toBe("RUNNING")
  })

  test("stable and failed map to success/failure", () => {
    expect(jobStatus("blue")).toBe("SUCCESS")
    expect(jobStatus("red")).toBe("FAILURE")
    // Yellow is unstable, not failed: the label should say so.
    expect(jobStatus("yellow")).toBe("UNSTABLE")
  })

  test("inactive colors are skipped, not running", () => {
    // Regression: everything that was not blue/red used to render as RUNNING,
    // so disabled and not-built jobs showed a spinner.
    expect(jobStatus("disabled")).toBe("SKIPPED")
    expect(jobStatus("notbuilt")).toBe("SKIPPED")
    // An aborted job is not "disabled".
    expect(jobStatus("aborted")).toBe("ABORTED")
    expect(jobStatus("grey")).toBe("SKIPPED")
    expect(jobStatus(null)).toBe("SKIPPED")
    expect(jobStatus(undefined)).toBe("SKIPPED")
  })
})
