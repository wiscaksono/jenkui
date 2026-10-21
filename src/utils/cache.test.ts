import { afterAll, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const dir = mkdtempSync(join(tmpdir(), "jenkui-cache-"))
process.env.XDG_CACHE_HOME = dir
const { readCache, writeCache } = await import("./cache")

afterAll(() => rmSync(dir, { recursive: true, force: true }))

test("round-trips a value", () => {
  writeCache("orgs-test", [{ name: "POLARIS" }])
  expect(readCache<Array<{ name: string }>>("orgs-test", 60_000)).toEqual([{ name: "POLARIS" }])
})

test("drops an expired entry", () => {
  writeCache("expired", { ok: true })
  expect(readCache<{ ok: boolean }>("expired", -1)).toBeNull()
})

test("does not write oversized payloads", () => {
  writeCache("huge", { text: "x".repeat(2_000_001) })
  expect(readCache<{ text: string }>("huge", 60_000)).toBeNull()
})

test("returns null for a missing key", () => {
  expect(readCache<unknown>("never-written", 60_000)).toBeNull()
})
