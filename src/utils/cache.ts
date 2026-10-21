import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

// Small disk cache for the expensive view tree. The first paint can reuse the
// previous list while a fresh fetch runs in the background.
const CACHE_DIR = join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "jenkui")
const MAX_BYTES = 2_000_000

function pathFor(key: string): string {
  const digest = createHash("sha1").update(key).digest("hex").slice(0, 16)
  return join(CACHE_DIR, `${digest}.json`)
}

export function readCache<T>(key: string, maxAgeMs: number): T | null {
  try {
    const parsed = JSON.parse(readFileSync(pathFor(key), "utf8")) as { savedAt?: unknown; data?: T }
    if (typeof parsed.savedAt !== "number" || parsed.data === undefined) return null
    if (Date.now() - parsed.savedAt > maxAgeMs) return null
    return parsed.data
  } catch {
    return null
  }
}

export function writeCache<T>(key: string, data: T): void {
  try {
    const body = JSON.stringify({ savedAt: Date.now(), data })
    if (body.length > MAX_BYTES) return
    mkdirSync(CACHE_DIR, { recursive: true })
    writeFileSync(pathFor(key), body)
  } catch {
    // A cache write must never break the app.
  }
}
