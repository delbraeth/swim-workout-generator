// bank_importer.mjs — shared JS→DB import logic for the canonical bank.
//
// Spec: UGC_COACH_SETS_SCOPE.md §2 (hybrid DB+JS-export architecture).
//
// Used by:
//   - tools/sync_bank.mjs --import (Cap'n's laptop CLI)
//   - server.js POST /api/admin/run-bank-import (in-process from Hyperlift)
//
// Walks the 12 JS bank constants in public/index.html via balanced-bracket
// scan + vm.runInNewContext, then INSERTs each as bank_options + bank_sets
// rows with author_sub=NULL, visibility='canonical', in_export=TRUE.
// Idempotent on set IDs (re-runnable safely).

import fs   from "fs";
import vm   from "vm";
import crypto from "crypto";

// ─── bank-constant inventory ─────────────────────────────────────────────
// 12 constants × the shape they expose, mapped to (section, pool_mode).
// Object-keyed constants (DRILL_*, MAIN_*) have type/stroke sub-keys.
export const CONSTANTS = [
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

// "technique" is a workout type (alongside im/distance/etc), NOT a stroke.
// "free" doesn't appear as a key; distance/endurance fill that role.
const TYPE_KEYS   = new Set(["im", "distance", "sprint", "endurance", "mixed", "technique"]);
const STROKE_KEYS = new Set(["back", "breast", "fly", "free"]);

// ─── JS-constant extraction (balanced-bracket scan, string-aware) ────────
// Mirrors tools/bank_review.py.extract_bank_text. Bank constants are pure
// data (objects + primitives + strings); no functions or template literals.
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
          return vm.runInNewContext(`(${text})`);
        }
      }
    }
    i++;
  }
  throw new Error(`unterminated bracket for ${name}`);
}

// ─── option-ID generation ────────────────────────────────────────────────
// "o_" prefix + 6 base36 chars. ~2.18B keyspace; collision risk negligible
// at ~600 rows. Mirrors db.js genTeamId convention.
function genOptionId() {
  const n = crypto.randomBytes(4).readUInt32BE(0);
  return "o_" + n.toString(36).padStart(6, "0").slice(-6);
}

// ─── flatten one constant into option-row + set-row payloads ────────────
function flattenConst(spec, raw, log) {
  const out = [];
  const push = (opt, typeId, strokeId) => {
    out.push(buildOption(spec, opt, typeId, strokeId));
  };

  if (spec.shape === "array") {
    for (const opt of raw) push(opt, null, null);
  } else {
    for (const key of Object.keys(raw)) {
      const typeId   = TYPE_KEYS.has(key)   ? key : null;
      const strokeId = STROKE_KEYS.has(key) ? key : null;
      if (!typeId && !strokeId) {
        log(`  [warn] unknown key ${JSON.stringify(key)} in ${spec.name}; skipping`);
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
    in_export:     1,
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

// ─── public entry point ──────────────────────────────────────────────────
/**
 * Import the canonical bank from JS constants into DB rows.
 *
 * @param {object}   args
 * @param {object}   args.pool      mariadb pool (from db.js)
 * @param {string}   args.htmlPath  absolute path to public/index.html
 * @param {boolean}  [args.dryRun]  if true, skip all DB writes
 * @param {Function} [args.log]     progress logger; default console.log
 * @returns {Promise<{
 *   totalOptions: number,
 *   totalSets:    number,
 *   insertedOptions: number,
 *   insertedSets:    number,
 *   skippedOptions:  number,
 *   existingSetCount: number,
 *   dryRun: boolean,
 *   perConstant: Array<{name:string, options:number, sets:number}>,
 * }>}
 */
export async function importBank({ pool, htmlPath, dryRun = false, log = console.log }) {
  if (!pool) throw new Error("pool required");
  if (!htmlPath) throw new Error("htmlPath required");
  const html = fs.readFileSync(htmlPath, "utf8");
  log(`Loaded ${htmlPath} (${html.length.toLocaleString()} bytes)`);

  // 1. Walk constants → in-memory rows
  const all = [];
  const perConstant = [];
  for (const spec of CONSTANTS) {
    const raw  = extractConst(html, spec.name);
    const flat = flattenConst(spec, raw, log);
    const setCount = flat.reduce((acc, r) => acc + r.sets.length, 0);
    log(`  ${spec.name.padEnd(24)} → ${String(flat.length).padStart(4)} options, ${String(setCount).padStart(5)} sets`);
    perConstant.push({ name: spec.name, options: flat.length, sets: setCount });
    all.push(...flat);
  }
  const totalOptions = all.length;
  const totalSets    = all.reduce((acc, r) => acc + r.sets.length, 0);
  log(`\nTotal across 12 constants: ${totalOptions} options, ${totalSets} sets`);

  if (dryRun) {
    log("\n[dry-run] no DB writes.");
    return { totalOptions, totalSets, insertedOptions: 0, insertedSets: 0,
             skippedOptions: 0, existingSetCount: 0, dryRun: true, perConstant };
  }

  // 2. Idempotency check — query existing set IDs.
  const existingSets   = await pool.query("SELECT `id` FROM `bank_sets`");
  const existingSetIds = new Set(existingSets.map(r => r.id));
  log(`\nDB already has ${existingSetIds.size} bank_sets rows.`);

  let skippedOptions  = 0;
  let insertedOptions = 0;
  let insertedSets    = 0;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const { option, sets } of all) {
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

  log("\n─── results ───");
  log(`  options inserted: ${insertedOptions}`);
  log(`  sets inserted:    ${insertedSets}`);
  log(`  options skipped:  ${skippedOptions} (already had at least one set in DB)`);

  return {
    totalOptions, totalSets, insertedOptions, insertedSets, skippedOptions,
    existingSetCount: existingSetIds.size, dryRun: false, perConstant,
  };
}
