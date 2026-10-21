import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useTerminalDimensions } from "@opentui/react"
import { layoutFor, type Layout } from "../utils/layout"

const LayoutContext = createContext<Layout>(layoutFor(80, 24))

export function LayoutProvider({ children }: { children: ReactNode }) {
  const { width, height } = useTerminalDimensions()
  const layout = useMemo(() => layoutFor(width, height), [width, height])
  return <LayoutContext.Provider value={layout}>{children}</LayoutContext.Provider>
}

export function useLayout(): Layout {
  return useContext(LayoutContext)
}
