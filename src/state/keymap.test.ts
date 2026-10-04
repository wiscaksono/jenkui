import { describe, expect, test } from "bun:test"
import { keyToAction } from "./keymap"
import { initialState, type AppState } from "./store"

const state = (over: Partial<AppState> = {}): AppState => ({ ...initialState, ...over })

describe("keyToAction", () => {
  test("enter drills in (the list has no internal handler anymore)", () => {
    for (const key of ["enter", "return", "linefeed"]) {
      expect(keyToAction(state({ view: "org" }), key)).toEqual({ type: "drillIn" })
    }
  })

  test("l and right drill in while browsing", () => {
    expect(keyToAction(state({ view: "org" }), "l")).toEqual({ type: "drillIn" })
    expect(keyToAction(state({ view: "deploy" }), "right")).toEqual({ type: "drillIn" })
  })

  test("j/k and arrows move the selection in list views", () => {
    expect(keyToAction(state({ view: "org" }), "j")).toEqual({ type: "moveSelection", delta: 1 })
    expect(keyToAction(state({ view: "org" }), "down")).toEqual({ type: "moveSelection", delta: 1 })
    expect(keyToAction(state({ view: "deploy" }), "k")).toEqual({ type: "moveSelection", delta: -1 })
    expect(keyToAction(state({ view: "project" }), "up")).toEqual({ type: "moveSelection", delta: -1 })
  })

  test("the run view leaves j/k/arrows to the log scrollbox", () => {
    // Regression: global j/k used to fight the log scroll for the same keys.
    for (const key of ["j", "k", "up", "down"]) {
      expect(keyToAction(state({ view: "run" }), key)).toBeNull()
    }
    // But navigation still works there.
    expect(keyToAction(state({ view: "run" }), "h")).toEqual({ type: "goBack" })
    expect(keyToAction(state({ view: "run" }), "escape")).toEqual({ type: "goBack" })
  })

  test("h, left and escape go back", () => {
    expect(keyToAction(state({ view: "project" }), "h")).toEqual({ type: "goBack" })
    expect(keyToAction(state({ view: "deploy" }), "escape")).toEqual({ type: "goBack" })
  })

  test("while searching only escape/enter leave and / clears", () => {
    const searching = state({ mode: "search", view: "org" })
    expect(keyToAction(searching, "escape")).toEqual({ type: "exitSearch" })
    expect(keyToAction(searching, "enter")).toEqual({ type: "exitSearch" })
    expect(keyToAction(searching, "/")).toEqual({ type: "clearQuery" })
    // Typing letters (including h/l) must reach the input, not navigation.
    expect(keyToAction(searching, "h")).toBeNull()
    expect(keyToAction(searching, "l")).toBeNull()
    expect(keyToAction(searching, "left")).toBeNull()
    expect(keyToAction(searching, "q")).toBeNull()
  })

  test("r refreshes and q quits outside search", () => {
    expect(keyToAction(state(), "r")).toEqual({ type: "refresh" })
    expect(keyToAction(state(), "q")).toEqual({ type: "quit" })
    expect(keyToAction(state({ mode: "search" }), "q")).toBeNull()
  })

  test("? opens help outside search, but is plain text inside the search box", () => {
    expect(keyToAction(state(), "?")).toEqual({ type: "openHelp" })
    expect(keyToAction(state({ mode: "search" }), "?")).toBeNull()
  })

  test("help is modal: it owns every key while open", () => {
    const open = state({ helpOpen: true })
    expect(keyToAction(open, "escape")).toEqual({ type: "closeHelp" })
    expect(keyToAction(open, "?")).toEqual({ type: "closeHelp" })
    expect(keyToAction(open, "q")).toEqual({ type: "closeHelp" })
    // Navigation keys must not leak through to the list behind the dialog.
    expect(keyToAction(open, "j")).toBeNull()
    expect(keyToAction(open, "l")).toBeNull()
    expect(keyToAction(open, "r")).toBeNull()
    expect(keyToAction(open, "/")).toBeNull()
  })

  test("p opens the profile picker outside search", () => {
    expect(keyToAction(state(), "p")).toEqual({ type: "openProfiles" })
    expect(keyToAction(state({ view: "run" }), "p")).toEqual({ type: "openProfiles" })
    expect(keyToAction(state({ mode: "search" }), "p")).toBeNull()
  })

  test("the profile picker is modal and moves with j/k", () => {
    const open = state({ profileOpen: true })
    expect(keyToAction(open, "j")).toEqual({ type: "moveProfile", delta: 1 })
    expect(keyToAction(open, "down")).toEqual({ type: "moveProfile", delta: 1 })
    expect(keyToAction(open, "k")).toEqual({ type: "moveProfile", delta: -1 })
    expect(keyToAction(open, "escape")).toEqual({ type: "closeProfiles" })
    expect(keyToAction(open, "p")).toEqual({ type: "closeProfiles" })
    // Unrelated keys are swallowed while the picker is open.
    expect(keyToAction(open, "/")).toBeNull()
    expect(keyToAction(open, "r")).toBeNull()
  })

  test("write keys map in list and run views", () => {
    for (const view of ["project", "deploy", "run"] as const) {
      expect(keyToAction(state({ view }), "b")).toEqual({ type: "triggerBuild" })
      expect(keyToAction(state({ view }), "x")).toEqual({ type: "stopBuild" })
      expect(keyToAction(state({ view }), "o")).toEqual({ type: "openConsole" })
      expect(keyToAction(state({ view }), "y")).toEqual({ type: "copyLink" })
      expect(keyToAction(state({ view }), "f")).toEqual({ type: "cycleFilter" })
      expect(keyToAction(state({ view }), "A")).toEqual({ type: "toggleAutoRefresh" })
    }
    // In search mode these are text.
    expect(keyToAction(state({ mode: "search" }), "b")).toBeNull()
    expect(keyToAction(state({ mode: "search" }), "f")).toBeNull()
  })

  test("confirm dialog is modal: y/enter accept, n/esc decline", () => {
    const confirming = state({
      confirm: { kind: "build", label: "Build x?", profile: "dev", url: "http://x" },
    })
    expect(keyToAction(confirming, "enter")).toEqual({ type: "confirmYes" })
    expect(keyToAction(confirming, "y")).toEqual({ type: "confirmYes" })
    expect(keyToAction(confirming, "escape")).toEqual({ type: "confirmNo" })
    expect(keyToAction(confirming, "n")).toEqual({ type: "confirmNo" })
    // Everything else is swallowed.
    expect(keyToAction(confirming, "b")).toBeNull()
    expect(keyToAction(confirming, "j")).toBeNull()
    expect(keyToAction(confirming, "q")).toEqual({ type: "confirmNo" })
  })

  test("dot opens the queue, which is modal and moves with j/k", () => {
    expect(keyToAction(state({ view: "org" }), ".")).toEqual({ type: "openQueue" })
    const open = state({ queueOpen: true })
    expect(keyToAction(open, "j")).toEqual({ type: "moveQueue", delta: 1 })
    expect(keyToAction(open, "k")).toEqual({ type: "moveQueue", delta: -1 })
    expect(keyToAction(open, "escape")).toEqual({ type: "closeQueue" })
    expect(keyToAction(open, ".")).toEqual({ type: "closeQueue" })
    expect(keyToAction(open, "b")).toBeNull()
    expect(keyToAction(open, "/")).toBeNull()
  })
})
