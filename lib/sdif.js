// lib/sdif.js — SDIF (SD3 / CL2) interchange parser. Pure, no DB, no deps.
// Parses the fixed-width 160-char records a Hy-Tek (or other) meet/team manager emits.
// We read D0 (individual event = swimmer + event + time); A0/Z0 for sanity; skip the rest.
//
// ⚠ FIXED-WIDTH OFFSETS + CODE MAPS BELOW ARE THE CALIBRATION RISK. They follow the
// published SDIF v3 layout but must be confirmed against a real .sd3/.cl2 sample before
// imported times are trusted. They're isolated as named constants for easy correction.
// See SDIF_IMPORT_SCOPE.md. The import flow gates everything behind a dry-run preview.

// 1-indexed [start, length] per SDIF v3 D0 (Individual Event) record.
const D0 = {
  name:        [12, 28],   // "Last, First MI"
  uss:         [40, 12],   // registration #
  birthdate:   [56, 8],    // MMDDYYYY
  sex:         [66, 1],    // M / F
  distance:    [68, 4],    // event distance
  stroke:      [72, 1],    // stroke code (see STROKE)
  // Four time slots (each 8-wide, right-justified, + 1-char course). A meet RESULTS
  // file fills finals; a Team Manager BEST-TIMES export fills only seed. Calibrated
  // against a real .sd3 (2026-06-09): seed time [89,8] course [97,1] confirmed.
  seedTime:    [89, 8],  seedCourse:    [97, 1],
  prelimTime:  [98, 8],  prelimCourse:  [106, 1],
  swimoffTime: [107, 8], swimoffCourse: [115, 1],
  finalsTime:  [116, 8], finalsCourse:  [124, 1],
};
// Time-slot priority: prefer an achieved result (finals → swim-off → prelim), else the
// seed slot (best-times exports live here). First slot that parses as a real time wins.
const D0_TIME_SLOTS = [
  ["finalsTime", "finalsCourse"], ["swimoffTime", "swimoffCourse"],
  ["prelimTime", "prelimCourse"], ["seedTime", "seedCourse"],
];

const STROKE = { "1": "free", "2": "back", "3": "breast", "4": "fly", "5": "im" };
// Course/status code → SetForge course. Accept numeric AND alpha (vendor variants).
// CONFIRM against a sample — this is the most likely thing to need fixing.
const COURSE = {
  "1": "scm", "2": "scy", "3": "lcm",
  "S": "scm", "Y": "scy", "L": "lcm", "M": "lcm",
};

const slice = (line, [start, len]) => (line || "").substr(start - 1, len);
const trim  = (s) => (s || "").replace(/\s+/g, " ").trim();

// SDIF time field → seconds (float), or null for blanks / NS / DQ / SCR / DNF / 0.
export function parseSdifTime(raw) {
  const t = (raw || "").trim().toUpperCase();
  if (!t || /^(NS|DQ|SCR|DNF|DFS|NT|0+(\.0+)?)$/.test(t.replace(/[^0-9A-Z.:]/g, ""))) return null;
  // Forms: "SS.hh", "M:SS.hh", "MM:SS.hh". Strip any trailing course letter just in case.
  const m = t.match(/^(?:(\d+):)?(\d{1,2}(?:\.\d{1,2})?)$/);
  if (!m) return null;
  const mins = m[1] ? parseInt(m[1], 10) : 0;
  const secs = parseFloat(m[2]);
  if (!Number.isFinite(secs)) return null;
  const total = mins * 60 + secs;
  return total > 0 ? Math.round(total * 100) / 100 : null;
}

// MMDDYYYY → "YYYY-MM-DD" (or null).
export function parseSdifDate(raw) {
  const d = (raw || "").trim();
  if (!/^\d{8}$/.test(d)) return null;
  const mm = d.slice(0, 2), dd = d.slice(2, 4), yyyy = d.slice(4, 8);
  if (mm === "00" || dd === "00" || yyyy === "0000") return null;
  return `${yyyy}-${mm}-${dd}`;
}

// "Last, First MI" → { last, first, display }.
export function parseSdifName(raw) {
  const n = trim(raw);
  if (!n) return { last: "", first: "", display: "" };
  const [last, rest] = n.includes(",") ? n.split(",") : [n, ""];
  const first = trim(rest).split(" ")[0] || "";
  return { last: trim(last), first, display: trim(`${first} ${trim(last)}`) };
}

const EVENT_DISTANCES = new Set([25, 50, 100, 200, 400, 500, 800, 1000, 1500, 1650]);

// Parse a single D0 record into a normalized row (or { skipped } if unusable).
function parseD0(line) {
  const { last, first, display } = parseSdifName(slice(line, D0.name));
  const uss = trim(slice(line, D0.uss));
  const dob = parseSdifDate(slice(line, D0.birthdate));
  const sex = trim(slice(line, D0.sex)).toUpperCase();
  const distance = parseInt(trim(slice(line, D0.distance)), 10);
  const strokeCode = trim(slice(line, D0.stroke));
  const stroke = STROKE[strokeCode] || null;

  // First time slot that parses as a real time wins (finals → … → seed).
  let timeText = "", courseRaw = "", timeSecs = null;
  for (const [tk, ck] of D0_TIME_SLOTS) {
    const tt = trim(slice(line, D0[tk]));
    const ts = parseSdifTime(tt);
    if (ts != null) { timeText = tt; courseRaw = trim(slice(line, D0[ck])); timeSecs = ts; break; }
  }
  const course = COURSE[(courseRaw || "").toUpperCase()] || null;

  const base = { last, first, name: display, uss: uss || null, dob, sex: sex || null,
                 distance: Number.isFinite(distance) ? distance : null, strokeCode, stroke,
                 course, timeText, timeSecs };
  if (!display) return { ...base, skipped: "no_name" };
  if (!stroke)  return { ...base, skipped: "unknown_stroke" };
  if (!Number.isFinite(distance) || !EVENT_DISTANCES.has(distance)) return { ...base, skipped: "bad_distance" };
  if (timeSecs == null) return { ...base, skipped: "no_time" };       // NS/DQ/scratch/seed-only
  if (!course)  return { ...base, skipped: "unknown_course" };
  base.eventLabel = `${distance} ${stroke}`;
  return base;
}

// Split into records: line-delimited first; fall back to fixed 160-char chunking.
function toRecords(text) {
  const lines = String(text).split(/\r\n|\r|\n/).filter(l => l.length >= 2);
  if (lines.length > 1) return lines;
  const one = String(text).replace(/\r|\n/g, "");
  const out = [];
  for (let i = 0; i + 2 <= one.length; i += 160) out.push(one.substr(i, 160));
  return out;
}

/**
 * Parse an SDIF file's text. Pure. Returns:
 *   { ok, meta:{org,version}, rows:[…valid D0…], skipped:[…D0 with reason…], counts }
 */
export function parseSdif(text) {
  const records = toRecords(text);
  const meta = { org: null, version: null };
  const rows = [], skipped = [];
  let d0 = 0;
  for (const rec of records) {
    const type = rec.substr(0, 2).toUpperCase();
    if (type === "A0") { meta.org = trim(rec.substr(2, 1)); meta.version = trim(rec.substr(30, 10)) || null; continue; }
    if (type !== "D0") continue;
    d0++;
    const row = parseD0(rec);
    if (row.skipped) skipped.push(row); else rows.push(row);
  }
  return {
    ok: rows.length > 0,
    meta,
    rows,
    skipped,
    counts: { records: records.length, d0, parsed: rows.length, skipped: skipped.length },
  };
}
