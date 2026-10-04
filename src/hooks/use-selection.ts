import { useMemo } from "react"
import type { Deployment, Organization } from "../types"
import type { AppState } from "../state/store"
import { resolveSelection, type Selection } from "./resolve-selection"

export function useSelection(
  state: AppState,
  organizations: Organization[],
  deploymentsByJob: Record<string, Deployment[]>,
): Selection {
  return useMemo(
    () => resolveSelection(state, organizations, deploymentsByJob),
    [state, organizations, deploymentsByJob],
  )
}
