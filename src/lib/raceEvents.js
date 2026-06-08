// src/lib/raceEvents.js — shared race-event taxonomy + time helpers for the
// HS race-pace pack (Phase 5 #4). Pure, dependency-free; imported by the engine,
// server, and web UI. High-school events are short-course yards (SCY); `course`
// is stored per goal/PR time, defaulting to 25y.

export const RACE_EVENTS = [
  { id: "free_50",    stroke: "free",   dist: 50,  label: "50 Free" },
  { id: "free_100",   stroke: "free",   dist: 100, label: "100 Free" },
  { id: "free_200",   stroke: "free",   dist: 200, label: "200 Free" },
  { id: "free_500",   stroke: "free",   dist: 500, label: "500 Free" },
  { id: "back_100",   stroke: "back",   dist: 100, label: "100 Back" },
  { id: "breast_100", stroke: "breast", dist: 100, label: "100 Breast" },
  { id: "fly_100",    stroke: "fly",    dist: 100, label: "100 Fly" },
  { id: "im_200",     stroke: "im",     dist: 200, label: "200 IM" },
];

export const RACE_EVENT_IDS = RACE_EVENTS.map(e => e.id);
export const RACE_TIME_KINDS = ["goal", "pr"];

export function raceEvent(id)      { return RACE_EVENTS.find(e => e.id === id) || null; }
export function eventLabel(id)     { const e = raceEvent(id); return e ? e.label : id; }
export function isValidEvent(id)   { return RACE_EVENT_IDS.includes(id); }

// Goal/PR pace per `per` yards (e.g. per=50 → target 50 split) from a total event
// time in seconds. Returns seconds, or null if unknown event / no time.
export function pacePer(eventId, totalSecs, per = 100) {
  const e = raceEvent(eventId);
  if (!e || !totalSecs || totalSecs <= 0) return null;
  return totalSecs * (per / e.dist);
}

// "1:52.34" / "52.3" / "112.34" → seconds (number), or null if unparseable.
export function parseRaceTime(str) {
  if (str == null) return null;
  const s = String(str).trim();
  if (!s) return null;
  let secs;
  if (s.includes(":")) {
    const [m, rest] = s.split(":");
    const mm = parseInt(m, 10);
    const ss = parseFloat(rest);
    if (Number.isNaN(mm) || Number.isNaN(ss) || ss >= 60) return null;
    secs = mm * 60 + ss;
  } else {
    secs = parseFloat(s);
  }
  if (Number.isNaN(secs) || secs <= 0 || secs > 3600) return null;
  return Math.round(secs * 100) / 100; // hundredths
}

// seconds → "M:SS.xx" (or "SS.xx" under a minute).
export function formatRaceTime(secs) {
  if (secs == null || Number.isNaN(secs)) return "";
  const m = Math.floor(secs / 60);
  const s = secs - m * 60;
  const ss = s.toFixed(2).padStart(5, "0"); // e.g. "07.80"
  return m > 0 ? `${m}:${ss}` : s.toFixed(2);
}
