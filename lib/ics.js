// lib/ics.js — minimal RFC 5545 iCalendar (.ics) generator. Pure + dependency-free.
//
// Used by the live-subscribe calendar feed (GET /calendar/:token.ics). Emits an
// all-day VEVENT per item by default; team events that carry a venue-local start
// time become timed VEVENTs (DTSTART/DTEND in UTC). Kept deliberately small: text
// escaping + 75-octet line folding + CRLF joins, which is what Apple/Google
// Calendar require to parse a feed without warnings.

// Escape per RFC 5545 §3.3.11: backslash, semicolon, comma, and newlines.
function escapeText(s) {
  return String(s == null ? "" : s)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

// "2026-06-05" → "20260605" for DATE-valued properties (all-day events).
function ymdToIcsDate(ymd) {
  return String(ymd || "").replace(/-/g, "");
}

// Fold a content line to 75 octets max, continuation lines start with a space
// (RFC 5545 §3.1). We fold on character boundaries; ASCII content stays correct,
// and our content is ASCII after escaping.
function foldLine(line) {
  if (line.length <= 75) return line;
  const parts = [];
  let i = 0;
  parts.push(line.slice(0, 75));
  i = 75;
  while (i < line.length) {
    parts.push(" " + line.slice(i, i + 74)); // 74 + leading space = 75
    i += 74;
  }
  return parts.join("\r\n");
}

// Compute the UTC offset (in ms) that an IANA time zone is at for a given UTC
// instant. Uses Intl to read back the wall-clock the zone shows for that instant,
// then diffs against the instant — no dependency, DST-aware.
function tzOffsetMs(utcMs, tz) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const map = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) map[p.type] = p.value;
  let hour = Number(map.hour);
  if (hour === 24) hour = 0; // some engines render midnight as 24
  const asIfUtc = Date.UTC(
    Number(map.year), Number(map.month) - 1, Number(map.day),
    hour, Number(map.minute), Number(map.second)
  );
  return asIfUtc - utcMs;
}

// Resolve a venue-local wall time (date "YYYY-MM-DD", time "HH:MM", IANA tz) to a
// UTC Date. Returns null if any piece is missing or unparseable. (Ambiguous/skipped
// DST hours resolve to the standard-offset reading — acceptable for a calendar feed.)
function zonedToUtc(ymd, hhmm, tz) {
  if (!ymd || !hhmm || !tz) return null;
  const [y, mo, d] = String(ymd).split("-").map(Number);
  const [h, mi] = String(hhmm).split(":").map(Number);
  if ([y, mo, d, h, mi].some(n => !Number.isFinite(n))) return null;
  // Treat the wall time as if it were UTC, then subtract the zone's offset at
  // that instant to land on the true UTC instant (local = utc + offset).
  const asUTC = Date.UTC(y, mo - 1, d, h, mi, 0);
  let offset;
  try { offset = tzOffsetMs(asUTC, tz); } catch (_) { return null; }
  const out = new Date(asUTC - offset);
  return Number.isNaN(out.getTime()) ? null : out;
}

// A UTC Date → "YYYYMMDDTHHMMSSZ" (RFC 5545 UTC form, no VTIMEZONE needed).
function toUtcStamp(d) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
}

// Resolve an optional timed marker { date, time, tz } on an item to a UTC Date.
function resolveTimed(s) {
  return s ? zonedToUtc(s.date, s.time, s.tz) : null;
}

// events: [{ uid, date (YMD, all-day), summary, description?, location?,
//            start?: { date, time, tz }, end?: { date, time, tz } }]
//   When `start` resolves, the event is emitted as a timed VEVENT (UTC DTSTART);
//   DTEND uses `end` if it resolves, else start + 2h. Otherwise it stays all-day.
// opts:   { calName, prodId, domain }
export function buildIcs(events = [], opts = {}) {
  const domain = opts.domain || "setforge.io";
  const prodId = opts.prodId || "-//SetForge//Calendar Feed//EN";
  const calName = opts.calName || "SetForge";
  // A fixed DTSTAMP is fine for a feed; clients use UID for identity. Use a stable
  // value derived from nothing time-sensitive to keep output deterministic per call
  // is NOT required — but we DO need a valid UTC stamp. Caller passes nowIso.
  const dtstamp = (opts.nowIso || "1970-01-01T00:00:00Z")
    .replace(/[-:]/g, "").replace(/\.\d+/, "").replace(/Z?$/, "Z");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:" + escapeText(prodId),
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:" + escapeText(calName),
  ];

  for (const ev of events) {
    if (!ev || !ev.uid) continue;
    const startUtc = resolveTimed(ev.start);
    if (!startUtc && !ev.date) continue; // need a timed start OR an all-day date
    lines.push("BEGIN:VEVENT");
    lines.push("UID:" + escapeText(ev.uid) + "@" + domain);
    lines.push("DTSTAMP:" + dtstamp);
    if (startUtc) {
      // Timed event: emit UTC instants. DTEND = explicit `end`, else start + 2h.
      const endUtc = resolveTimed(ev.end) || new Date(startUtc.getTime() + 2 * 3600 * 1000);
      lines.push("DTSTART:" + toUtcStamp(startUtc));
      lines.push("DTEND:" + toUtcStamp(endUtc));
    } else {
      // All-day event: DTEND is the exclusive next day. Compute via the YMD.
      lines.push("DTSTART;VALUE=DATE:" + ymdToIcsDate(ev.date));
      lines.push("DTEND;VALUE=DATE:" + ymdToIcsDate(nextYmd(ev.date)));
    }
    lines.push("SUMMARY:" + escapeText(ev.summary || "Event"));
    if (ev.description) lines.push("DESCRIPTION:" + escapeText(ev.description));
    if (ev.location)    lines.push("LOCATION:" + escapeText(ev.location));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// "2026-06-05" → "2026-06-06" (UTC-safe; DATE-only arithmetic).
function nextYmd(ymd) {
  const d = new Date(String(ymd) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return ymd;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
