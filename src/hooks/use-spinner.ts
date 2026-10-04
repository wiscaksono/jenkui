import { useEffect, useState } from "react"
import { spinnerFrame } from "../utils/spinner"

const INTERVAL_MS = 100

// Animates only while `active`, so idle screens do not keep a timer running.
export function useSpinner(active: boolean): string {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setTick((t) => t + 1), INTERVAL_MS)
    return () => clearInterval(timer)
  }, [active])

  return spinnerFrame(tick)
}
