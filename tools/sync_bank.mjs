#!/usr/bin/env node
/**
 * sync_bank.mjs — Bank ↔ DB sync (UGC Phase A+B).
 *
 * Spec: UGC_COACH_SETS_SCOPE.md §2 (hybrid DB+JS-export architecture).
 *
 * MODES
 *   --import   One-time backfill (Phase A): walks the 12 JS bank constants
 *              in public/index.html and INSERTs each as bank_options +
 *              bank_sets rows with author_sub=NULL, visibility='canonical',
 *              in_export=TRUE. Idempotent on set IDs (re-runnable).
 *
 *   --export   (Phase B — not implemented yet.) Reads canonical rows
 *              (visibility='canonical' AND in_export=TRUE) from DB and
 *              regenerates public/bank-generated.js.
 *
 * REQUIRED ENV (loaded from process.env)
 *   DB_HOST, DB_USER, DB_PASSWORD   (DB_NAME defaults to vero_swimgen)
 *
 * USAGE (prefer Node 20.6+ for --env-file support; we ship Node 22)
 *   node --env-file=.env tools/sync_bank.mjs --import --dry-run   # preview counts
 *   node --env-file=.env tools/sync_bank.mjs --import             # apply backfill
 *
 * PROD WORKFLOW
 *   1. Commit + push migration 030 + this script.
 *   2. Apply migration 030 against prod DB:
 *        mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD vero_swimgen \
 *              < migrations/030_ugc_bank.sql
 *   3. Dry-run to confirm counts: `--import --dry-run`
 *   4. Apply: `--import` — idempotent on set IDs, safe to re-run.
 *
 * Expected counts after import (as of 2026-05-24): 1311 options, 3276 sets.
 */
import fs   from "fs";
import path from "path";
import vm   from "vm";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { pool, dbActive } from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");
const HTML_PATH  = path.join(ROOT, "public", "index.html");

// ─── bank-constant inventory ─────────────────────────────────────────────
// 12 constants × the shape they expose, mapped to (section, pool_mode).
// Object-keyed constants (DRILL_*, MAIN_*) have 8 sub-keys: 5 types +
// 3 strokes. Type/stroke routing happens at insert time.
const CONSTANTS = [
  // 25y (default suffix-less)
  { name: "WARMUP_OPTIONS",       section: "warmup",   poolMode: "25y", shape: "array"  },
  { name: "DRILL_OPTIONS",        section: "drill",    poolMode: "25y", shape: "object" },
  { name: "MAIN_OPTIONS",         section: "main",     poolMode: "25y", shape: "object" },
  { name: "COOLDOWN_OPTIONS",     section: "cooldown", poolMode: "25y", shape: "array"  },
  // 50m (long-course meters)
  { name: "WARMUP_OPTIONS_50M",   section: "warmup",   poolMode: "50m", shape: "array"  },
  { name: "COOLDOWN_OPTIONS_50M", section: "cooldown", poolMode: "50m", shape: "array"  },
  { name: "DRILL_OPTIONS_50M",    section: "drill",    poolMode: "50m", shape: "object" },
  { name: "MAIN_OPTIONS_50M",     section: "main",     poolMode: "50m", shape: "object" },
  // 25m (short-course meters, suffix _SCM)
  { name: "WARMUP_OPTIONS_SCM",   section: "warmup",   poolMode: "25m", shape: "array"  },
  { name: "COOLDOWN_OPTIONS_SCM", section: "cooldown", poolMode: "25m", shape: "array"  },
  { name: "DRILL_OPTIONS_SCM",    section: "drill",    poolMode: "25m", shape: "object" },
  { name: "MAIN_OPTIONS_SCM",     section: "main",     poolMode: "25m", shape: "object" },
];

// Type/stroke routing for object-keyed constants.
// Real keys observed: im, distance, sprint, endurance, mixed, technique,
// back, breast, fly. "free" doesn't appear as a key; distance/endurance
// fill that role. "technique" is a workout type, not a stroke.
const TYPE_KEYS   = new Set(["im", "distance", "sprint", "endurance", "mixed", "technique"]);
const STROKE_KEYS = new Set(["back", "breast", "fly", "free"]);

// ─── JS-constant extraction (balanced-bracket scan, string-aware) ────────
// Mirrors the pattern in tools/bank_review.py.extract_bank_text.
function extractConst(html, name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*`);
  const m  = html.match(re);
  if (!m) throw new Error(`bank constant not found in HTML: ${name}`);
  const start  = m.index + m[0].length;
  const openCh = html[start];
  if (openCh !== "[" && openCh !== "{") {
    throw new Error(`unexpected start char ${JSON.stringify(openCh)} for ${name}`);
  }
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
          // eval in a sandbox — bank data is pure (objects + primitives + strings)
          return vm.runInNewContext(`(${text})`);
        }
      }
    }
    i++;
  }
  throw new Error(`unterminated bracket for ${name}`);
}

// ─── option-ID generation ────────────────────────────────────────────────
// Mirrors db.js genTeamId pattern: prefix + 6 base36 chars. Collision
// risk negligible at our scale (~600 rows; ~2.18B keyspace).
function genOptionId() {
  const n = crypto.randomBytes(4).readUInt32BE(0);
  return "o_" + n.toString(36).padStart(6, "0").slice(-6);
}

// ─── flatten one constant into option-row + set-row payloads ────────────
// Returns an array of { option, sets }.
function flattenConst(spec, raw) {
  const out = [];
  const push = (opt, typeId, strokeId) => {
    out.push(buildOption(spec, opt, typeId, strokeId));
  };

  if (spec.shape === "array") {
    // warmup / cooldown — type_id and stroke_id stay null
    for (const opt of raw) push(opt, null, null);
  } else {
    // object — drill / main, keyed by type_id OR stroke_id
    for (const key of Object.keys(raw)) {
      const typeId   = TYPE_KEYS.has(key)   ? key : null;
      const strokeId = STROKE_KEYS.has(key) ? key : null;
      if (!typeId && !strokeId) {
        console.warn(`[warn] unknown key ${JSON.stringify(key)} in ${spec.name}; skipping`);
        continue;
      }
      for (const opt of raw[key]) push(opt, typeId, strokeId);
    }
  }
  return out;
}

function buildOption(spec, opt, typeId, strokeId) {
  const optionId = genOptionId();
  const option = {
    id:            optionId,
    section:       spec.section,
    type_id:       typeId,
    stroke_id:     strokeId,
    pool_mode:     spec.poolMode,
    label:         opt.label,
    total_yards:   opt.totalYards,
    type_affinity: opt.typeAffinity ? JSON.stringify(opt.typeAffinity) : null,
    author_sub:    null,
    visibility:    "canonical",
    in_export:     1,      // backfill is already live in JS
  };
  const sets = (opt.sets || []).map((s, i) => ({
    id:        s.id,
    option_id: optionId,
    seq:       i,
    reps:      s.reps,
    dist:      s.dist,
    desc:      s.desc,
    interval:  s.interval,
    focus:     s.focus ?? null,
    stroke:    s.stroke ?? null,
    eq:        s.eq ?? null,
  }));
  return { option, sets };
}

// ─── --import flow ───────────────────────────────────────────────────────
async function runImport({ dryRun }) {
  if (!dbActive) {
    console.error("DB not configured. Set DB_HOST / DB_USER / DB_PASSWORD.");
    process.exit(2);
  }
  const html = fs.readFileSync(HTML_PATH, "utf8");
  console.log(`Loaded ${HTML_PATH} (${html.length.toLocaleString()} bytes)`);

  // 1. Walk constants → in-memory rows
  const all = [];
  for (const spec of CONSTANTS) {
    const raw     = extractConst(html, spec.name);
    const flat    = flattenConst(spec, raw);
    const setCount = flat.reduce((acc, r) => acc + r.sets.length, 0);
    console.log(`  ${spec.name.padEnd(24)} → ${String(flat.length).padStart(4)} options, ${String(setCount).padStart(5)} sets`);
    all.push(...flat);
  }
  const totalOptions = all.length;
  const totalSets    = all.reduce((acc, r) => acc + r.sets.length, 0);
  console.log(`\nTotal across 12 constants: ${totalOptions} options, ${totalSets} sets`);

  if (dryRun) {
    console.log("\n[dry-run] no DB writes. Re-run without --dry-run to apply.");
    await pool.end();
    return;
  }

  // 2. Idempotency check — query existing set IDs from DB.
  // Set IDs (s_xxxxxx) are stable across JS → DB. If a set ID is already
  // in bank_sets, we skip the whole owning option (assume prior partial run).
  const existingSets = await pool.query("SELECT `id` FROM `bank_sets`");
  const existingSetIds = new Set(existingSets.map(r => r.id));
  console.log(`\nDB already has ${existingSetIds.size} bank_sets rows.`);

  let skippedOptions = 0;
  let insertedOptions = 0;
  let insertedSets = 0;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const { option, sets } of all) {
      // Skip if ANY of this option's set IDs already exist (avoids dupes
      // if the first option-row was inserted but sets weren't, or vice
      // versa — re-run is safe).
      if (sets.some(s => existingSetIds.has(s.id))) {
        skippedOptions++;
        continue;
      }
      await conn.query(
        "INSERT INTO `bank_options` " +
        "(`id`, `section`, `type_id`, `stroke_id`, `pool_mode`, `label`, " +
        " `total_yards`, `type_affinity`, `author_sub`, `visibility`, `in_export`) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          option.id, option.section, option.type_id, option.stroke_id,
          option.pool_mode, option.label, option.total_yards,
          option.type_affinity, option.author_sub, option.visibility,
          option.in_export,
        ]
      );
      insertedOptions++;
      for (const s of sets) {
        await conn.query(
          "INSERT INTO `bank_sets` " +
          "(`id`, `option_id`, `seq`, `reps`, `dist`, `desc`, `interval`, " +
          " `focus`, `stroke`, `eq`) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [s.id, s.option_id, s.seq, s.reps, s.dist, s.desc, s.interval,
           s.focus, s.stroke, s.eq]
        );
        insertedSets++;
      }
    }
    await conn.commit();
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    throw err;
  } finally {
    conn.release();
  }

  console.log("\n─── results ───");
  console.log(`  options inserted: ${insertedOptions}`);
  console.log(`  sets inserted:    ${insertedSets}`);
  console.log(`  options skipped:  ${skippedOptions} (already had at least one set in DB)`);
  console.log("Done.");

  await pool.end();
}

// ─── --export flow (Phase B, stub) ───────────────────────────────────────
async function runExport() {
  console.error("--export not implemented yet (Phase B).");
  process.exit(3);
}

// ─── arg parse ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
if (args.includes("--import")) {
  runImport({ dryRun }).catch(err => {
    console.error("import failed:", err);
    process.exit(1);
  });
} else if (args.includes("--export")) {
  runExport().catch(err => {
    console.error("export failed:", err);
    process.exit(1);
  });
} else {
  console.error("Usage: node tools/sync_bank.mjs --import [--dry-run]");
  console.error("       node tools/sync_bank.mjs --export   (Phase B, not yet)");
  process.exit(2);
}
