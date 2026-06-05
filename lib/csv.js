// lib/csv.js — minimal RFC 4180 CSV serializer. Pure + dependency-free.
//
// A field is quoted when it contains a comma, double-quote, CR, or LF; embedded
// quotes are doubled. Rows are joined with CRLF (the RFC line terminator, and what
// Hy-Tek Meet Manager / Excel expect). Leading BOM optional for Excel UTF-8.

function escapeField(v) {
  const s = v == null ? "" : String(v);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// headers: string[]; rows: Array<Array<string|number|null>>
export function toCsv(headers, rows, { bom = false } = {}) {
  const lines = [];
  if (Array.isArray(headers) && headers.length) lines.push(headers.map(escapeField).join(","));
  for (const row of rows || []) lines.push((row || []).map(escapeField).join(","));
  return (bom ? "﻿" : "") + lines.join("\r\n") + "\r\n";
}
