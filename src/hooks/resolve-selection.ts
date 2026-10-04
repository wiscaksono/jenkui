import type { Deployment, Organization, Project } from "../types"
import type { AppState, StatusFilter } from "../state/store"
import { fuzzyMatch } from "../utils/search"
import type { StageStatus } from "../types"

export type Selection = {
  orgList: Organization[]
  org: Organization | undefined
  orgIndex: number
  projectList: Project[]
  project: Project | undefined
  projectIndex: number
  deployList: Deployment[]
  deployment: Deployment | undefined
  deploymentIndex: number
}

const indexOf = <T>(list: T[], item: T | undefined) => (item ? Math.max(list.indexOf(item), 0) : 0)
const filterBy = <T extends { name: string }>(list: T[], query: string): T[] =>
  query ? list.filter((item) => fuzzyMatch(item.name, query)) : list

const matchesFilter = (status: StageStatus, filter: StatusFilter): boolean => {
  if (filter === "all") return true
  if (filter === "failed") return status === "FAILURE"
  if (filter === "running") return status === "RUNNING"
  if (filter === "success") return status === "SUCCESS"
  return true
}

// Resolves what the user currently sees and has selected. Search only filters
// the active level, so a deeper query never changes the parent context. The
// selection is resolved by identity (name/number), so filtering falls back to
// the first visible item instead of a stale position.
export function resolveSelection(
  state: AppState,
  organizations: Organization[],
  deploymentsByJob: Record<string, Deployment[]>,
): Selection {
  const q = (state.queries[state.view] ?? "").trim().toLowerCase()
  const filter = state.statusFilter

  const orgList = filterBy(organizations, state.view === "org" ? q : "")
  const org = orgList.find((o) => o.name === state.selectedOrg) ?? orgList[0]

  const allProjects = org?.projects ?? []
  const projectList = filterBy(allProjects, state.view === "project" ? q : "").filter((p) =>
    matchesFilter(p.status, filter),
  )
  // Match by path: in prod the same job name can live in several folders, so a
  // name-based match would jump to the first occurrence of a duplicate.
  const project = projectList.find((p) => p.path === state.selectedProject) ?? projectList[0]

  const allDeployments = project ? (deploymentsByJob[project.path] ?? []) : []
  const deployList = filterBy(allDeployments, state.view === "deploy" ? q : "").filter((d) =>
    matchesFilter(d.status, filter),
  )
  const deployment = deployList.find((d) => d.number === state.selectedDeployment) ?? deployList[0]

  return {
    orgList,
    org,
    orgIndex: indexOf(orgList, org),
    projectList,
    project,
    projectIndex: indexOf(projectList, project),
    deployList,
    deployment,
    deploymentIndex: indexOf(deployList, deployment),
  }
}
