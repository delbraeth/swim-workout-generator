// lib/season.js — pure helpers for the meet-anchored taper feature.
//
// Per MEET_ANCHORED_TAPER_SCOPE.md §3.3. Reused by server (db helper that
// computes the suggested phase from an anchor row) AND by client (Training
// Phase pill renders the suggestion + countdown badge). No DB access; no
// React dependency; safe to import anywhere.

// Fixed phase-roll formula per scope decision 1. Configurable mesocycle
// lengths live in the full season planner (Phase 5+), explicitly cut from
// the cheap version.
//
// Boundaries:
//   weeksOut >= 12 → "base"
//   8 <= weeksOut < 12 → "build"
//   4 <= weeksOut < 8 → "peak"
//   0 <= weeksOut < 4 → "taper"
//   weeksOut < 0      → null (past — anchor inactive)
//   weeksOut == null  → null (no anchor)
//
// Returns one of the canonical phase ids (base | build | peak | taper)
// or null. The phase ids match the keys in PHASE_META in public/index.html.
export function suggestedPhaseFromWeeksOut(weeksOut) {
  if (weeksOut == null) return null;
  if (weeksOut < 0)     return null;
  if (weeksOut >= 12)   return "base";
  if (weeksOut >= 8)    return "build";
  if (weeksOut >= 4)    return "peak";
  return "taper";
}

// Compute integer weeks between today and an event date. Floor, so an
// event 6 days out reads as "0 wks" not "1 wk." asOf parameter exists
// so server, client, and tests can all share the same computation
// against a known reference date (and for time-travel testing).
//
// Returns whole weeks (can be negative for past events) or null if
// either input is null/invalid.
export function weeksUntilEvent(eventDateStr, asOf = new Date()) {
  if (!eventDateStr) return null;
  const eventDate = (eventDateStr instanceof Date) ? eventDateStr : new Date(String(eventDateStr));
  if (Number.isNaN(eventDate.getTime())) return null;
  const diffMs = eventDate.getTime() - asOf.getTime();
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
}
