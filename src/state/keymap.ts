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
  | { type: "openQueueItem" }
  | { type: "cancelQueue" }
  | { type: "closeParams" }
  | { type: "moveParam"; delta: number }
  | { type: "startParamEdit" }
  | { type: "cancelParamEdit" }
  | { type: "commitParam" }

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
    if (ENTER_KEYS.has(key)) return { type: "openQueueItem" }
    if (key === "x") return { type: "cancelQueue" }
    return null
  }

  // The confirmation dialog is modal. While a write is in flight it ignores
  // every key, so a double Enter cannot trigger two builds.
  if (state.confirm) {
    if (state.busy) return null
    if (ENTER_KEYS.has(key) || key === "y") return { type: "confirmYes" }
    if (key === "escape" || key === "n" || key === "q") return { type: "confirmNo" }
    return null
  }

  // The build-parameter form owns every key. While a field is being edited the
  // text input keeps letters; only Enter/Escape leave that mode.
  if (state.params) {
    if (state.params.editing) {
      if (ENTER_KEYS.has(key)) return { type: "commitParam" }
      if (key === "escape") return { type: "cancelParamEdit" }
      return null
    }
    if (key === "escape" || key === "q") return { type: "closeParams" }
    if (DOWN_KEYS.has(key)) return { type: "moveParam", delta: 1 }
    if (UP_KEYS.has(key)) return { type: "moveParam", delta: -1 }
    if (ENTER_KEYS.has(key)) return { type: "startParamEdit" }
    if (key === "b") return { type: "triggerBuild" }
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
    if (key === "A") return { type: "toggleAutoRefresh" }
    if (key === ".") return { type: "openQueue" }
    return null
  }

  if (key === "?") return { type: "openHelp" }
  if (key === "q") return { type: "quit" }
  if (key === "r") return { type: "refresh" }
  if (key === "p") return { type: "openProfiles" }
  if (key === "/") return { type: "enterSearch" }
  // Write/open actions target a job, so they need a level that has one. The org
  // row is a view, not a job; building "the first project" from there would be
  // a nasty surprise.
  if (key === "b" && state.view !== "org") return { type: "triggerBuild" }
  // Abort only makes sense where a build is actually visible.
  if (key === "x" && state.view === "deploy") return { type: "stopBuild" }
  if (key === "o" && state.view !== "org") return { type: "openConsole" }
  if (key === "y" && state.view !== "org") return { type: "copyLink" }
  if (key === "f" && (state.view === "project" || state.view === "deploy")) return { type: "cycleFilter" }
  if (key === "A") return { type: "toggleAutoRefresh" }
  if (key === ".") return { type: "openQueue" }
  if (DOWN_KEYS.has(key)) return { type: "moveSelection", delta: 1 }
  if (UP_KEYS.has(key)) return { type: "moveSelection", delta: -1 }
  if (BACK_KEYS.has(key)) return { type: "goBack" }
  if (FORWARD_KEYS.has(key) || ENTER_KEYS.has(key)) return { type: "drillIn" }
  return null
}
