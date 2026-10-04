// Fuzzy search helpers. Kept pure so the matching rules are testable.

// Damerau-Levenshtein distance with an early cutoff: like Levenshtein but a
// swap of two adjacent characters counts as one edit, which is the common
// "o/a typed out of order" typo. Returns early once the best possible distance
// exceeds `max`.
function editDistanceWithin(a: string, b: string, max: number): number | null {
  if (Math.abs(a.length - b.length) > max) return null
  const rows: number[][] = []
  for (let i = 0; i <= a.length; i++) {
    const row: number[] = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(
        (rows[i - 1]?.[j] ?? i) + 1,
        row[j - 1]! + 1,
        (rows[i - 1]?.[j - 1] ?? Math.max(i, j)) + cost,
      )
      // Adjacent transposition.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, (rows[i - 2]?.[j - 2] ?? 0) + 1)
      }
      row[j] = value
      if (value < best) best = value
    }
    if (best > max) return null
    rows[i] = row
  }
  const result = rows[a.length]?.[b.length]
  return result !== undefined && result <= max ? result : null
}

// True when `query` appears as a subsequence (e.g. "plrs" in "polaris").
function isSubsequence(query: string, text: string): boolean {
  let qi = 0
  for (let ti = 0; ti < text.length && qi < query.length; ti++) {
    if (text[ti] === query[qi]) qi++
  }
  return qi === query.length
}

const MAX_EDIT_DISTANCE = 1

// Lenient match used for filtering lists. Accepts a plain substring, a loose
// subsequence, or a near-miss (distance 1) against the start of any token, so
// typos like "poalris" still find "polaris".
export function fuzzyMatch(text: string, query: string): boolean {
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  if (q.length === 0) return true
  if (t.includes(q)) return true
  if (q.length < 3) return false
  if (isSubsequence(q, t)) return true
  // Compare against the beginning of each token for near-miss typos.
  for (const token of t.split(/[^a-z0-9]+/)) {
    if (token.length === 0) continue
    const head = token.slice(0, q.length + MAX_EDIT_DISTANCE)
    if (editDistanceWithin(q, head, MAX_EDIT_DISTANCE) !== null) return true
  }
  return false
}
