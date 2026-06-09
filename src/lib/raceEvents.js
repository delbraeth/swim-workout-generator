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
  // Triathlon swim legs (open-water freestyle, metric). category:"tri" so the UI can
  // group/filter them apart from the pool events. Phase 1 of the multi-sport set —
  // they flow through the existing race-pace engine (repDist=100 for >200) unchanged.
  { id: "free_750",   stroke: "free", dist: 750,  label: "Sprint Tri Swim (750m)", category: "tri" },
  { id: "free_1500",  stroke: "free", dist: 1500, label: "Olympic Swim (1.5K)",    category: "tri" },
  { id: "free_1900",  stroke: "free", dist: 1900, label: "70.3 Swim (1.9K)",       category: "tri" },
  { id: "free_3800",  stroke: "free", dist: 3800, label: "Ironman Swim (3.8K)",    category: "tri" },
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

// Critical Swim Speed (triathlete pace anchor). From a 400 + 200 time trial:
// CSS speed = (400−200) / (t400 − t200); pace per 100 = 100/speed = (t400 − t200)/2.
// Returns seconds per 100 (rounded to hundredths), or null if the inputs are invalid
// (need t400 > t200 — a 400 must be slower in total than a 200).
export function cssFromTT(t400Secs, t200Secs) {
  if (!t400Secs || !t200Secs || t400Secs <= t200Secs) return null;
  const css = (t400Secs - t200Secs) / 2;
  return css > 0 ? Math.round(css * 100) / 100 : null;
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
  if (Number.isNaN(secs) || secs <= 0 || secs > 7200) return null;   // 2h cap — fits a slow 3800m tri leg
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
