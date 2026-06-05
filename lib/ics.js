// lib/ics.js — minimal RFC 5545 iCalendar (.ics) generator. Pure + dependency-free.
//
// Used by the live-subscribe calendar feed (GET /calendar/:token.ics). Emits an
// all-day VEVENT per item (practices + team events have a date, no time). Kept
// deliberately small: text escaping + 75-octet line folding + CRLF joins, which is
// what Apple/Google Calendar require to parse a feed without warnings.

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

// events: [{ uid, date (YMD, all-day), summary, description?, location? }]
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
    if (!ev || !ev.date || !ev.uid) continue;
    const d = ymdToIcsDate(ev.date);
    // For all-day events, DTEND is the exclusive next day. Compute via the YMD.
    const next = nextYmd(ev.date);
    lines.push("BEGIN:VEVENT");
    lines.push("UID:" + escapeText(ev.uid) + "@" + domain);
    lines.push("DTSTAMP:" + dtstamp);
    lines.push("DTSTART;VALUE=DATE:" + d);
    lines.push("DTEND;VALUE=DATE:" + ymdToIcsDate(next));
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
