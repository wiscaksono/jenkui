import { describe, expect, test } from "bun:test"
import { DEFAULT_CONFIG, parseConfig } from "./index"

describe("parseConfig", () => {
  test("falls back to defaults when the file is empty", () => {
    const parsed = parseConfig({})
    expect(parsed.profiles.default?.url).toBe("https://jenkins.example.com")
    expect(parsed.defaultProfile).toBe("default")
    expect(parsed.pollIntervalMs).toBe(DEFAULT_CONFIG.pollIntervalMs)
    expect(parsed.autoRefreshMs).toBe(DEFAULT_CONFIG.autoRefreshMs)
    expect(parsed.pageSize).toBe(DEFAULT_CONFIG.pageSize)
  })

  test("clamps intervals and page size to safe ranges", () => {
    const parsed = parseConfig({
      pollIntervalMs: -5,
      autoRefreshMs: 10,
      pageSize: 9999,
    })
    expect(parsed.pollIntervalMs).toBe(250)
    expect(parsed.autoRefreshMs).toBe(1000)
    expect(parsed.pageSize).toBe(500)
  })

  test("keeps a single top-level jenkins object as one profile", () => {
    const parsed = parseConfig({ jenkins: { url: "https://ci.example.com/", user: "u", token: "t" } })
    expect(parsed.profiles.default).toEqual({
      url: "https://ci.example.com",
      user: "u",
      token: "t",
      insecure: undefined,
    })
  })

  test("drops a defaultProfile that does not exist", () => {
    const parsed = parseConfig({
      defaultProfile: "nope",
      profiles: { dev: { url: "https://dev.example.com", user: "u", token: "t" } },
    })
    expect(parsed.defaultProfile).toBe("dev")
  })

  test("keeps the insecure flag for self-signed certificates", () => {
    const parsed = parseConfig({
      profiles: { prod: { url: "https://prod.example.com", user: "u", token: "t", insecure: true } },
    })
    expect(parsed.profiles.prod?.insecure).toBe(true)
  })
})
