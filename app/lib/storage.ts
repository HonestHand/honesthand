/**
 * localStorage utilities for HonestHand.
 * All keys are namespaced by `hh:<operation>:<userId>` to avoid collisions.
 * All functions are SSR-safe — localStorage access is wrapped in try/catch.
 */

const NS = 'hh'

function read(key: string): string | null {
  try { return localStorage.getItem(`${NS}:${key}`) } catch { return null }
}

function write(key: string, value: string): void {
  try { localStorage.setItem(`${NS}:${key}`, value) } catch { /* quota or SSR — ignore */ }
}

// ─── Saved / bookmarked opportunities ────────────────────────────────────────

export function getSavedOpportunities(userId: string): Set<string> {
  try {
    const raw = read(`saved:${userId}`)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch { return new Set() }
}

/**
 * Toggle a saved opportunity. Returns the NEW saved state (true = now saved).
 */
export function toggleSavedOpportunity(userId: string, oppId: string): boolean {
  const saved = getSavedOpportunities(userId)
  if (saved.has(oppId)) {
    saved.delete(oppId)
  } else {
    saved.add(oppId)
  }
  write(`saved:${userId}`, JSON.stringify([...saved]))
  return saved.has(oppId)
}

// ─── "New report" detection ───────────────────────────────────────────────────

/**
 * Returns the `generated_at` string from the last session that was marked as viewed.
 * Null if never viewed.
 */
export function getLastViewedReportDate(userId: string): string | null {
  return read(`lastViewed:${userId}`)
}

/**
 * Persist the current report's `generated_at` as "last viewed."
 * Call this after the user has had a moment to register the "Updated" banner.
 */
export function markReportViewed(userId: string, reportGeneratedAt: string): void {
  write(`lastViewed:${userId}`, reportGeneratedAt)
}

/**
 * Returns true if the current report was generated more recently than the last
 * time the user viewed a report — i.e., "this is a new report since your last visit."
 *
 * Returns false if the user has never viewed a report (first visit).
 */
export function isNewReportSinceLastView(userId: string, reportGeneratedAt: string): boolean {
  const last = getLastViewedReportDate(userId)
  if (!last) return false       // First-time visitor — don't show "Updated" on initial load
  return reportGeneratedAt !== last  // Changed since last view
}
