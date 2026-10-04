import type { AppState } from "./store"

// Everything the global keyboard layer can ask the app to do. List navigation
// and the run view's log scrolling are all decided here, so there is a single
// source of truth for key actions.
export type KeyAction =
  | { type: "exitSearch" }
  | { type: "clearQuery" }
  | { type: "enterSearch" }
  | { type: "goBack" }
  | { type: "drillIn" }
  | { type: "moveSelection"; delta: number }
  | { type: "refresh" }
  | { type: "quit" }
  | { type: "openHelp" }
  | { type: "closeHelp" }
  | { type: "openProfiles" }
  | { type: "closeProfiles" }
  | { type: "moveProfile"; delta: number }
  | { type: "triggerBuild" }
  | { type: "stopBuild" }
  | { type: "openConsole" }
  | { type: "copyLink" }
  | { type: "cycleFilter" }
  | { type: "toggleAutoRefresh" }
  | { type: "confirmYes" }
  | { type: "confirmNo" }
  | { type: "openQueue" }
  | { type: "closeQueue" }
  | { type: "moveQueue"; delta: number }

const ENTER_KEYS = new Set(["enter", "return", "linefeed"])
const BACK_KEYS = new Set(["escape", "h", "left"])
const FORWARD_KEYS = new Set(["l", "right"])
const DOWN_KEYS = new Set(["j", "down"])
const UP_KEYS = new Set(["k", "up"])

// Single source of truth for which key means what, by app state. Kept pure so
// the tricky overlaps (search vs. list, moves vs. navigation) are testable.
export function keyToAction(state: AppState, key: string): KeyAction | null {
  // The queue viewer is modal.
  if (state.queueOpen) {
    if (key === "escape" || key === "." || key === "q") return { type: "closeQueue" }
    if (DOWN_KEYS.has(key)) return { type: "moveQueue", delta: 1 }
    if (UP_KEYS.has(key)) return { type: "moveQueue", delta: -1 }
    return null
  }

  // The confirmation dialog is modal.
  if (state.confirm) {
    if (ENTER_KEYS.has(key) || key === "y") return { type: "confirmYes" }
    if (key === "escape" || key === "n" || key === "q") return { type: "confirmNo" }
    return null
  }

  // The profile picker is modal: it owns every key while open.
  if (state.profileOpen) {
    if (key === "escape" || key === "p" || key === "q") return { type: "closeProfiles" }
    if (DOWN_KEYS.has(key)) return { type: "moveProfile", delta: 1 }
    if (UP_KEYS.has(key)) return { type: "moveProfile", delta: -1 }
    if (ENTER_KEYS.has(key)) return { type: "closeProfiles" } // selection applied by the app
    return null
  }

  // The help dialog is modal: it owns every key while open.
  if (state.helpOpen) {
    if (key === "escape" || key === "?" || key === "q") return { type: "closeHelp" }
    return null
  }

  if (state.mode === "search") {
    // Inside the search box only escape/enter leave it; every other key is
    // text (or cursor movement), so the input keeps it.
    if (key === "escape" || ENTER_KEYS.has(key)) return { type: "exitSearch" }
    if (key === "/") return { type: "clearQuery" }
    return null
  }

  // Run view: the log scrollbox owns j/k and the arrows, so do not list-move.
  if (state.view === "run") {
    if (key === "?") return { type: "openHelp" }
    if (key === "h" || key === "left" || key === "escape") return { type: "goBack" }
    if (key === "q") return { type: "quit" }
    if (key === "r") return { type: "refresh" }
    if (key === "p") return { type: "openProfiles" }
    if (key === "/") return { type: "enterSearch" }
    if (key === "b") return { type: "triggerBuild" }
    if (key === "x") return { type: "stopBuild" }
    if (key === "o") return { type: "openConsole" }
    if (key === "y") return { type: "copyLink" }
    if (key === "f") return { type: "cycleFilter" }
    if (key === "A") return { type: "toggleAutoRefresh" }
    if (key === ".") return { type: "openQueue" }
    return null
  }

  if (key === "?") return { type: "openHelp" }
  if (key === "q") return { type: "quit" }
  if (key === "r") return { type: "refresh" }
  if (key === "p") return { type: "openProfiles" }
  if (key === "/") return { type: "enterSearch" }
  if (key === "b") return { type: "triggerBuild" }
  if (key === "x") return { type: "stopBuild" }
  if (key === "o") return { type: "openConsole" }
  if (key === "y") return { type: "copyLink" }
  if (key === "f") return { type: "cycleFilter" }
  if (key === "A") return { type: "toggleAutoRefresh" }
  if (key === ".") return { type: "openQueue" }
  if (DOWN_KEYS.has(key)) return { type: "moveSelection", delta: 1 }
  if (UP_KEYS.has(key)) return { type: "moveSelection", delta: -1 }
  if (BACK_KEYS.has(key)) return { type: "goBack" }
  if (FORWARD_KEYS.has(key) || ENTER_KEYS.has(key)) return { type: "drillIn" }
  return null
}
