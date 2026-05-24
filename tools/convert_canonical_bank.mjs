#!/usr/bin/env node
/**
 * convert_canonical_bank.mjs — one-shot conversion of the canonical JS
 * bank from object-keyed (DRILL_OPTIONS.im / .distance / .back / ...)
 * to flat-array with types[]/strokes[] tags.
 *
 * Phase H Stage 2. After running this + applying the output, the picker
 * filters by `opt.types.includes(typeId) || opt.strokes.includes(typeId)`
 * instead of `data[typeId]` direct lookup, which lets a single option
 * declare membership in multiple buckets without duplication.
 *
 * Usage:
 *   node tools/convert_canonical_bank.mjs           # prints converted JS to stdout
 *   node tools/convert_canonical_bank.mjs --apply   # writes back into public/index.html
 *
 * The --apply mode preserves the constant declarations' positions in
 * the file (uses the same balanced-bracket walker we use to read).
 *
 * Idempotency: re-running on already-converted bank is a no-op (it
 * detects the flat-array shape and emits it as-is).
 *
 * After this script, manual review of the diff is recommended. The
 * picker code in public/index.html needs corresponding updates in the
 * SAME commit (see Phase H.6).
 */
import fs   from "fs";
import path from "path";
import vm   from "vm";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");
const HTML_PATH  = path.join(ROOT, "public", "index.html");

// 12 canonical bank constants. Mirrors tools/bank_importer.mjs CONSTANTS.
const CONSTANTS = [
  { name: "WARMUP_OPTIONS",       shape: "array"  },
  { name: "DRILL_OPTIONS",        shape: "object" },
  { name: "MAIN_OPTIONS",         shape: "object" },
  { name: "COOLDOWN_OPTIONS",     shape: "array"  },
  { name: "WARMUP_OPTIONS_50M",   shape: "array"  },
  { name: "COOLDOWN_OPTIONS_50M", shape: "array"  },
  { name: "DRILL_OPTIONS_50M",    shape: "object" },
  { name: "MAIN_OPTIONS_50M",     shape: "object" },
  { name: "WARMUP_OPTIONS_SCM",   shape: "array"  },
  { name: "COOLDOWN_OPTIONS_SCM", shape: "array"  },
  { name: "DRILL_OPTIONS_SCM",    shape: "object" },
  { name: "MAIN_OPTIONS_SCM",     shape: "object" },
];

// Classification of object-keys into types vs strokes. Matches the
// UGC_TYPE_KEYS / UGC_STROKE_KEYS in db.js. "im" lives in both per the
// 2026-05-25 Cap'n decision; for canonical conversion we treat existing
// keyed-as-im rows as TYPE (which is where the canonical bank put them).
const TYPE_KEYS   = new Set(["im","distance","sprint","endurance","mixed","technique"]);
const STROKE_KEYS = new Set(["back","breast","fly","free"]);

// ─── extract balanced-bracket region of a const declaration ──────────────
function extractConst(html, name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*`);
  const m  = html.match(re);
  if (!m) throw new Error(`bank constant not found: ${name}`);
  const start  = m.index + m[0].length;
  const openCh = html[start];
  const closeCh = openCh === "[" ? "]" : "}";
  let depth = 0, inStr = false, strQuote = "";
  let i = start;
  while (i < html.length) {
    const c = html[i];
    if (inStr) {
      if (c === "\\") { i += 2; continue; }
      if (c === strQuote) inStr = false;
    } else {
      if (c === "\"" || c === "'") { inStr = true; strQuote = c; }
      else if (c === openCh) depth++;
      else if (c === closeCh) {
        depth--;
        if (depth === 0) {
          const text = html.slice(start, i + 1);
          return {
            text,
            startOffset: start,
            endOffset:   i + 1,
            data:        vm.runInNewContext(`(${text})`),
          };
        }
      }
    }
    i++;
  }
  throw new Error(`unterminated bracket for ${name}`);
}

// ─── render a JS option literal matching existing bank style ─────────────
// Each option lives on its own "block": header line with label + meta +
// `sets: [`, then one set per line, closing `]},`. Two-space indentation
// relative to the parent.
function renderSet(s) {
  const parts = [];
  parts.push(`id: ${JSON.stringify(s.id)}`);
  parts.push(`reps: ${s.reps}`);
  parts.push(`dist: ${s.dist}`);
  parts.push(`desc: ${JSON.stringify(s.desc)}`);
  parts.push(`interval: ${JSON.stringify(s.interval)}`);
  if (s.focus)  parts.push(`focus: ${JSON.stringify(s.focus)}`);
  if (s.stroke) parts.push(`stroke: ${JSON.stringify(s.stroke)}`);
  if (s.eq)     parts.push(`eq: ${JSON.stringify(s.eq)}`);
  return `{ ${parts.join(", ")} }`;
}

function renderOption(opt, indent = "      ") {
  // Standard fields first; tags last (so the visual diff is mostly
  // appending `types: [...], strokes: [...]` to the end of the header).
  const head = [];
  head.push(`label: ${JSON.stringify(opt.label)}`);
  if (Array.isArray(opt.typeAffinity) && opt.typeAffinity.length > 0) {
    head.push(`typeAffinity: ${JSON.stringify(opt.typeAffinity)}`);
  }
  head.push(`totalYards: ${opt.totalYards}`);
  // Tags: types and/or strokes. Both arrays always present (even if []).
  head.push(`types: ${JSON.stringify(opt.types || [])}`);
  head.push(`strokes: ${JSON.stringify(opt.strokes || [])}`);
  const lines = [];
  lines.push(`${indent}{ ${head.join(", ")}, sets: [`);
  for (const s of (opt.sets || [])) {
    lines.push(`${indent}    ${renderSet(s)},`);
  }
  lines.push(`${indent}  ]},`);
  return lines.join("\n");
}

// ─── convert one constant's data into flat-array form ────────────────────
function convertConstantData(spec, data) {
  if (spec.shape === "array") {
    // warmup/cooldown — flat. Add empty types/strokes for shape uniformity.
    return data.map(opt => ({ ...opt, types: [], strokes: [] }));
  }
  // object-keyed (drill/main) — for each sub-key, emit option with
  // types=[key] or strokes=[key]. Dedup ONLY when label + first set id
  // both match (defensively safer than label-only — two options can
  // share a label but be physically different). The dedup case is
  // when a coach explicitly duplicated an option across keys to land
  // in multiple buckets; we collapse those into one multi-tag option.
  // Non-matching label-OR-set-id pairs stay as separate options.
  const byKey = new Map();
  const out = [];
  for (const key of Object.keys(data)) {
    const isType   = TYPE_KEYS.has(key);
    const isStroke = STROKE_KEYS.has(key);
    if (!isType && !isStroke) {
      console.warn(`  [warn] unknown key in ${spec.name}: ${JSON.stringify(key)} — skipping`);
      continue;
    }
    for (const opt of (data[key] || [])) {
      const firstSetId = opt.sets?.[0]?.id || null;
      const dedupKey = `${opt.label}::${firstSetId}`;
      let existing = byKey.get(dedupKey);
      if (!existing) {
        existing = { ...opt, types: [], strokes: [] };
        byKey.set(dedupKey, existing);
        out.push(existing);
      }
      if (isType   && !existing.types.includes(key))   existing.types.push(key);
      if (isStroke && !existing.strokes.includes(key)) existing.strokes.push(key);
    }
  }
  return out;
}

// ─── replace the constant's text region in the html with new content ────
function replaceConstantText(html, slot, newInnerText) {
  return html.slice(0, slot.startOffset) + newInnerText + html.slice(slot.endOffset);
}

// ─── main ────────────────────────────────────────────────────────────────
const apply = process.argv.includes("--apply");
let html = fs.readFileSync(HTML_PATH, "utf8");

// We'll mutate html from the END toward the BEGINNING so offsets stay
// valid as we splice each constant.
const slots = [];
for (const spec of CONSTANTS) {
  const slot = extractConst(html, spec.name);
  slots.push({ spec, slot });
}
// Sort by descending startOffset so we can splice without recomputing.
slots.sort((a, b) => b.slot.startOffset - a.slot.startOffset);

let totalOptions = 0;
for (const { spec, slot } of slots) {
  const converted = convertConstantData(spec, slot.data);
  totalOptions += converted.length;
  console.log(`  ${spec.name.padEnd(24)} → ${String(converted.length).padStart(4)} options`);
  // Compose new constant body: flat array with one option per "block".
  const lines = ["["];
  for (const opt of converted) {
    lines.push(renderOption(opt));
  }
  lines.push("    ]");
  const newText = lines.join("\n");
  if (apply) {
    html = replaceConstantText(html, slot, newText);
  }
}

console.log(`\nTotal options after conversion: ${totalOptions}`);

if (apply) {
  fs.writeFileSync(HTML_PATH, html);
  console.log(`\nWrote ${HTML_PATH}.`);
  console.log(`Next: smoke-test the picker (Phase H.6 + H.7), then commit.`);
} else {
  console.log(`\n[dry-run] Re-run with --apply to write the conversion into ${HTML_PATH}.`);
  console.log(`(IMPORTANT: picker code in public/index.html still expects object-keyed shape until Phase H.6 lands; apply only as part of the Stage 2 commit.)`);
}
