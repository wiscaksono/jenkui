import type { View } from "../types"

export type Mode = "list" | "search"

export type StatusFilter = "all" | "failed" | "running" | "success"

export const STATUS_FILTERS: StatusFilter[] = ["all", "failed", "running", "success"]

/** A pending write action awaiting confirmation. */
export type ConfirmAction = { kind: "build" | "stop"; label: string; profile: string; url: string }

export type AppState = {
  view: View
  mode: Mode
  selectedOrg: string | null
  selectedProject: string | null
  selectedDeployment: number | null
  /** Search text per level, so returning to a level keeps its filter. */
  queries: Record<View, string>
  statusFilter: StatusFilter
  autoRefresh: boolean
  helpOpen: boolean
  profileOpen: boolean
  profileIndex: number
  confirm: ConfirmAction | null
  busy: boolean
  queueOpen: boolean
  queueIndex: number
}

export type AppAction =
  | { type: "drillIn" }
  | { type: "goBack" }
  | { type: "selectOrg"; name: string }
  | { type: "selectProject"; path: string }
  | { type: "selectDeployment"; number: number }
  | { type: "enterSearch" }
  | { type: "exitSearch" }
  | { type: "setQuery"; query: string }
  | { type: "clearQuery" }
  | { type: "setHelp"; open: boolean }
  | { type: "openProfiles" }
  | { type: "closeProfiles" }
  | { type: "moveProfile"; delta: number; count: number }
  | { type: "resetForProfile" }
  | { type: "cycleFilter" }
  | { type: "toggleAutoRefresh" }
  | { type: "askConfirm"; action: ConfirmAction }
  | { type: "clearConfirm" }
  | { type: "setBusy"; busy: boolean }
  | { type: "openQueue" }
  | { type: "closeQueue" }
  | { type: "moveQueue"; delta: number; count: number }

export const initialState: AppState = {
  view: "org",
  mode: "list",
  selectedOrg: null,
  selectedProject: null,
  selectedDeployment: null,
  queries: { org: "", project: "", deploy: "", run: "" },
  statusFilter: "all",
  autoRefresh: true,
  helpOpen: false,
  profileOpen: false,
  profileIndex: 0,
  confirm: null,
  busy: false,
  queueOpen: false,
  queueIndex: 0,
}

export function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "drillIn":
      // Queries are preserved per level, so drilling in no longer clears them.
      if (state.view === "org") return { ...state, view: "project" }
      if (state.view === "project") return { ...state, view: "deploy" }
      if (state.view === "deploy") return { ...state, view: "run", mode: "list" }
      return state

    case "goBack":
      if (state.view === "run") return { ...state, view: "deploy" }
      if (state.view === "deploy") return { ...state, view: "project" }
      if (state.view === "project") return { ...state, view: "org" }
      return state

    case "selectOrg":
      return { ...state, selectedOrg: action.name, selectedProject: null, selectedDeployment: null }

    case "selectProject":
      // Identity is the path (unique), not the name (repeats across folders).
      return { ...state, selectedProject: action.path, selectedDeployment: null }

    case "selectDeployment":
      return { ...state, selectedDeployment: action.number }

    case "enterSearch":
      return { ...state, mode: "search" }

    case "exitSearch":
      return { ...state, mode: "list" }

    case "setQuery":
      return { ...state, queries: { ...state.queries, [state.view]: action.query } }

    case "clearQuery":
      return { ...state, queries: { ...state.queries, [state.view]: "" } }

    case "setHelp":
      return { ...state, helpOpen: action.open }

    case "openProfiles":
      return { ...state, profileOpen: true, profileIndex: 0 }

    case "closeProfiles":
      return { ...state, profileOpen: false, profileIndex: 0 }

    case "moveProfile": {
      if (action.count === 0) return state
      const next = Math.max(0, Math.min(state.profileIndex + action.delta, action.count - 1))
      return { ...state, profileIndex: next }
    }

    case "resetForProfile":
      // A profile switch invalidates every selection: the new server has a
      // different hierarchy, so start clean at the top level.
      return {
        ...state,
        view: "org",
        mode: "list",
        selectedOrg: null,
        selectedProject: null,
        selectedDeployment: null,
        queries: { org: "", project: "", deploy: "", run: "" },
        confirm: null,
      }

    case "cycleFilter": {
      const index = STATUS_FILTERS.indexOf(state.statusFilter)
      const next = STATUS_FILTERS[(index + 1) % STATUS_FILTERS.length]!
      return { ...state, statusFilter: next }
    }

    case "toggleAutoRefresh":
      return { ...state, autoRefresh: !state.autoRefresh }

    case "askConfirm":
      return { ...state, confirm: action.action }

    case "clearConfirm":
      return { ...state, confirm: null }

    case "setBusy":
      return { ...state, busy: action.busy }

    case "openQueue":
      return { ...state, queueOpen: true, queueIndex: 0 }

    case "closeQueue":
      return { ...state, queueOpen: false, queueIndex: 0 }

    case "moveQueue": {
      if (action.count === 0) return state
      const next = Math.max(0, Math.min(state.queueIndex + action.delta, action.count - 1))
      return { ...state, queueIndex: next }
    }
  }
}
