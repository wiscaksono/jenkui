import { useEffect, useState } from "react"
import { spinnerFrame } from "../utils/spinner"

const INTERVAL_MS = 100

// Raw tick for callers that animate more than one glyph (e.g. the stage bars).
export function useSpinnerTick(active: boolean): number {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setTick((t) => t + 1), INTERVAL_MS)
    return () => clearInterval(timer)
  }, [active])

  return tick
}

// Animates only while `active`, so idle screens do not keep a timer running.
export function useSpinner(active: boolean): string {
  return spinnerFrame(useSpinnerTick(active))
}
