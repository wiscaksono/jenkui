import type { View } from "../types"

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

export function breadcrumbFor(view: View, orgName?: string, projectName?: string, deploymentName?: string): string {
  if (view === "org") return "\u{f07b} Organization"
  if (view === "project") return `\u{f07b} ${orgName} \u{203a} \u{f0ad} jobs`
  if (view === "deploy") return `\u{f07b} ${orgName} \u{203a} \u{f0ad} ${projectName} \u{203a} builds`
  return `\u{f07b} ${orgName} \u{203a} \u{f0ad} ${projectName} \u{203a} \u{f0e7} ${deploymentName}`
}
