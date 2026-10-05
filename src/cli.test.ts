import { describe, expect, test } from "bun:test"
import { parseArgs } from "./cli"

describe("parseArgs", () => {
  test("no arguments starts the UI", () => {
    expect(parseArgs([])).toEqual({ kind: "run", profile: undefined })
  })

  test("help and version flags", () => {
    expect(parseArgs(["--help"])).toEqual({ kind: "help" })
    expect(parseArgs(["-h"])).toEqual({ kind: "help" })
    expect(parseArgs(["--version"])).toEqual({ kind: "version" })
    expect(parseArgs(["-v"])).toEqual({ kind: "version" })
  })

  test("--profile selects a profile", () => {
    expect(parseArgs(["--profile", "prod"])).toEqual({ kind: "run", profile: "prod" })
    expect(parseArgs(["-p", "dev"])).toEqual({ kind: "run", profile: "dev" })
  })

  test("--profile list lists profiles", () => {
    expect(parseArgs(["--profile", "list"])).toEqual({ kind: "listProfiles" })
  })

  test("--profile without a value is an error", () => {
    expect(parseArgs(["--profile"])).toEqual({ kind: "error", message: "--profile needs a profile name" })
    expect(parseArgs(["--profile", "--help"])).toEqual({ kind: "error", message: "--profile needs a profile name" })
  })

  test("unknown arguments are an error", () => {
    const result = parseArgs(["--nope"])
    expect(result.kind).toBe("error")
  })
})
