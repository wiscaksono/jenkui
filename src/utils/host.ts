import { spawnSync } from "node:child_process"
import type { CliRenderer } from "@opentui/core"

// Copy text to the host clipboard. Prefers the terminal's OSC52 support (works
// over SSH); falls back to a platform clipboard tool when available.
export function copyToClipboard(renderer: CliRenderer, text: string): boolean {
  try {
    if (renderer.copyToClipboardOSC52(text)) return true
  } catch {
    // fall through to the platform tool
  }
  const tool = process.platform === "darwin" ? "pbcopy" : process.platform === "win32" ? "clip" : "xclip"
  try {
    const args = tool === "xclip" ? ["-selection", "clipboard"] : []
    const result = spawnSync(tool, args, { input: text })
    return result.status === 0
  } catch {
    return false
  }
}

// Open a URL in the user's browser, detached so it never blocks the UI.
export function openInBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open"
  const args = cmd === "cmd" ? ["/c", "start", "", url] : [url]
  try {
    const child = Bun.spawn([cmd, ...args], { stdio: ["ignore", "ignore", "ignore"] })
    child.unref()
  } catch {
    // ignore: opening a browser is best-effort
  }
}
