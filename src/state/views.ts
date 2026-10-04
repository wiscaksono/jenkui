import type { View } from "../types"

export type ViewMeta = {
  title: string
  placeholder: string
}

export const VIEW_META: Record<View, ViewMeta> = {
  org: {
    title: "Organization",
    placeholder: "Search Organization",
  },
  project: {
    title: "Project",
    placeholder: "Search Project",
  },
  deploy: {
    title: "Deployments",
    placeholder: "Search Deployment",
  },
  run: {
    title: "Stage View",
    placeholder: "Search Log",
  },
}

export function breadcrumbFor(view: View, orgName?: string, projectName?: string, deploymentName?: string): string {
  if (view === "org") return "\u{f07b} Organization"
  if (view === "project") return `\u{f07b} ${orgName} \u{203a} \u{f0ad} jobs`
  if (view === "deploy") return `\u{f07b} ${orgName} \u{203a} \u{f0ad} ${projectName} \u{203a} builds`
  return `\u{f07b} ${orgName} \u{203a} \u{f0ad} ${projectName} \u{203a} \u{f0e7} ${deploymentName}`
}
