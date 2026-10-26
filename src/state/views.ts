import type { StageStatus, View } from "../types"

export type ViewMeta = {
  placeholder: string
}

export const VIEW_META: Record<View, ViewMeta> = {
  org: {
    placeholder: "Search Organization",
  },
  project: {
    placeholder: "Search Project",
  },
  deploy: {
    placeholder: "Search Deployment",
  },
  run: {
    placeholder: "Search Log",
  },
}

export type TitleInput = {
  view: View
  orgName?: string
  projectName?: string
  deploymentName?: string
  status?: StageStatus
  live?: boolean
  profile?: string
  profileCount?: number
}

/**
 * Terminal title for the host terminal and for multiplexers such as rex, which
 * fall back to the foreground process name when nothing sets one. Plain text
 * only, since tab bars rarely render a Nerd Font.
 */
export function titleFor({
  view,
  orgName,
  projectName,
  deploymentName,
  status,
  live,
  profile,
  profileCount,
}: TitleInput): string {
  let scope: string
  if (view === "org") {
    scope = "organizations"
  } else if (view === "project") {
    scope = orgName ?? "projects"
  } else if (view === "deploy") {
    scope = [orgName, projectName].filter(Boolean).join(" \u203a ") || "builds"
  } else {
    const build = [projectName, deploymentName].filter(Boolean).join(" ") || "build"
    const state = [status ?? null, live ? "live" : null].filter(Boolean).join(" \u00b7 ")
    scope = state ? `${build} ${state}` : build
  }
  const profileTail = profileCount !== undefined && profileCount > 1 && profile ? ` \u00b7 ${profile}` : ""
  return `jenkui | ${scope}${profileTail}`
}

export function breadcrumbFor(view: View, orgName?: string, projectName?: string, deploymentName?: string): string {
  if (view === "org") return "\u{f07b} Organization"
  if (view === "project") return `\u{f07b} ${orgName} \u{203a} \u{f0ad} jobs`
  if (view === "deploy") return `\u{f07b} ${orgName} \u{203a} \u{f0ad} ${projectName} \u{203a} builds`
  return `\u{f07b} ${orgName} \u{203a} \u{f0ad} ${projectName} \u{203a} \u{f0e7} ${deploymentName}`
}
