// src/lib/featureFlags.js — Phase 6 "Team Option Visibility" registry (shared by
// the web client, the server resolver, and the owner config UI). Pure data +
// helpers, dependency-free, importable from both src/ (bundled) and node (server.js).
//
// A team OWNER can hide surfaces to simplify the app for a small/private/lesson
// team. v1 is TEAM-ONLY (group-override reserved — see migration 061 group_id).
//
// HARD GUARDRAILS baked in from the coaching-board eval (docs/COACH_BOARD_2026-06-06):
//   F1  race-pace is CORE — never a flag, never hideable (free-for-swimmers).
//   F2  Learn-to-Swim is CORE — never a flag (the lesson coach's whole product).
//   F3  whiteboard/print rides with `lane_plans`, not a low-value "chrome" flag.
//   F5  `compliance` is force-ON for any team WITH MINORS (resolver overrides the flag).
//   F6  Reports flag covers R1/R2/R3 only — R4 Program Recap is CORE (swimmer-facing).
//   F7  `constraints` defaults ON (injury/level-bearing), though still owner-toggleable.
// Anything not in FEATURE_FLAGS is CORE by definition and is never gated.

// Owner-toggleable bundles. `default` = value when a team has set nothing.
export const FEATURE_FLAGS = [
  { key: "events",           label: "Events & meets",        desc: "Meet/event calendar, RSVP, venues, weather, .ics feed, meet-anchored taper.", default: true },
  { key: "intent_planning",  label: "Week planning",         desc: "Plan-ahead workout intents + the week-view authoring + quick parser.",        default: true },
  { key: "attendance",       label: "Attendance / roll-call", desc: "Mark-practice-done + per-swimmer roll-call + attendance export.",            default: true },
  { key: "reports",          label: "Reports",               desc: "Coach analytics R1–R3 + exports. (Program Recap stays visible to swimmers.)", default: true },
  { key: "catalog",          label: "Catalog browser",       desc: "Browse the full set/exercise bank.",                                          default: true },
  { key: "ugc",              label: "My Sets authoring",     desc: "Author/save your own sets (UGC).",                                            default: true },
  { key: "curation",         label: "Team curation",         desc: "Tune the engine: favorites/disfavor, team default pace.",                     default: true },
  { key: "constraints",      label: "Per-swimmer limits",    desc: "Injury/equipment/level constraints per swimmer.",                             default: true },  // F7: default ON
  { key: "lane_plans",       label: "Lane plans & whiteboard", desc: "Saved lane plans, multi-lane generate, the whiteboard/print view.",         default: true },  // F3
  { key: "coach_notes",      label: "Coach notes",           desc: "Per-swimmer coach notes.",                                                    default: true },
  { key: "compliance",       label: "Compliance credentials", desc: "SafeSport / background-check / USA-S cert tracking.",                        default: true },  // F5: force-ON if minors
  { key: "advanced_generate", label: "Advanced generate options", desc: "Recovery day, mix-bias, section skip/add (+ dryland & source later). Basic equipment, race-pace & Learn-to-Swim always stay.", default: true },
  { key: "community",        label: "Community",             desc: "Discord link + Supporter tier.",                                              default: true },
  { key: "notifications",    label: "Browser notifications", desc: "Web-push opt-in.",                                                            default: true },
];

export const FEATURE_FLAG_KEYS = FEATURE_FLAGS.map(f => f.key);
const DEFAULTS = Object.fromEntries(FEATURE_FLAGS.map(f => [f.key, f.default]));

// Presets (owner picks one, then can fine-tune). Each is a full key→bool map.
// SIMPLE = the lesson/private coach (the Lesson-tier default): generate→run→log,
//   plus per-swimmer limits (mixed-age levels) ON; everything else off.
// STANDARD = small club: coach tools on, but the heaviest off by default.
// FULL = everything on (today's behavior — no change for existing teams).
function _all(v) { return Object.fromEntries(FEATURE_FLAG_KEYS.map(k => [k, v])); }

export const PRESETS = {
  full:     { ..._all(true) },
  standard: { ..._all(true), reports: false, curation: false, lane_plans: false },
  simple:   { ..._all(false), constraints: true },   // F7: lesson coach keeps per-swimmer level
};
export const PRESET_KEYS = ["simple", "standard", "full"];

// Resolve a team's effective flag map: preset (or all-default) overlaid with any
// explicit per-flag overrides. `hasMinors` forces `compliance` ON (F5).
// overrides: { [key]: bool }  (sparse). preset: "simple"|"standard"|"full"|null.
export function resolveTeamFlags({ preset = null, overrides = {}, hasMinors = false } = {}) {
  const base = (preset && PRESETS[preset]) ? PRESETS[preset] : DEFAULTS;
  const out = { ...base };
  for (const k of FEATURE_FLAG_KEYS) {
    if (Object.prototype.hasOwnProperty.call(overrides, k)) out[k] = !!overrides[k];
  }
  if (hasMinors) out.compliance = true;   // F5 — never hide compliance for minor teams
  return out;
}

// Multi-team union for PERSONAL surfaces: a flag is ON if ANY of the user's
// teams have it ON (the most-permissive read, so one strict team can't darken a
// surface another team enables). No teams → all defaults ON.
export function unionFlags(flagMaps = []) {
  if (!flagMaps.length) return { ...DEFAULTS };
  const out = _all(false);
  for (const m of flagMaps) for (const k of FEATURE_FLAG_KEYS) if (m && m[k]) out[k] = true;
  return out;
}
