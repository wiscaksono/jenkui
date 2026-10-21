import { useEffect, type RefObject } from "react"
import type { ScrollBoxRenderable } from "@opentui/core"

/**
 * Keeps the selected row inside a one-line-per-item scrollbox. Using absolute
 * scroll offsets avoids the delta accumulation scrollChildIntoView suffers
 * under fast input. The deferred tick lets the terminal lay out first.
 */
export function useScrollSelection(
  ref: RefObject<ScrollBoxRenderable | null>,
  selectedIndex: number,
  itemCount: number,
  focused = true,
): void {
  useEffect(() => {
    if (!focused) return
    const apply = () => {
      const box = ref.current
      if (!box) return
      const height = box.viewport.height
      if (!height) return
      if (selectedIndex < box.scrollTop) box.scrollTop = selectedIndex
      else if (selectedIndex >= box.scrollTop + height) box.scrollTop = selectedIndex - height + 1
    }
    apply()
    const timer = setTimeout(apply, 16)
    return () => clearTimeout(timer)
  }, [ref, focused, selectedIndex, itemCount])
}
