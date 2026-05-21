// sim_template_engine.mjs — exercise the TEMPLATE_ENGINE (S1) from Node.
//
// Same extract-and-eval pattern as sim_engine.mjs. Generates samples from
// each template across realistic (type × budget) combinations and prints
// them for coach-plausibility review.
//
// Usage:
//   node tools/sim_template_engine.mjs           # default sample matrix
//   node tools/sim_template_engine.mjs --batch 50 --template aerobic_volume
//
// Verifies S1 acceptance: every output has valid label, canonical dists,
// non-empty focus, and parseable intervals. Anything else is a regression
// before we even ship S1.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_PATH = path.join(__dirname, "..", "public", "index.html");

const html = fs.readFileSync(HTML_PATH, "utf8");
const lines = html.split("\n");
const startMarker = lines.findIndex(l => /<script\s+type="text\/babel">/.test(l));
const endMarker   = lines.findIndex(l => /^\s*function EquipmentBadge\b/.test(l));
if (startMarker < 0 || endMarker < 0) {
  console.error("could not locate <script> / EquipmentBadge boundaries");
  process.exit(1);
}
const extracted = lines.slice(startMarker + 1, endMarker).join("\n");

globalThis.React = { useState: () => [null, () => {}], useCallback: (f) => f, useMemo: (f) => f(), useEffect: () => {} };
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const captured = {};
const runner = new Function(
  "captured",
  extracted +
    "\n;captured.TEMPLATE_ENGINE = TEMPLATE_ENGINE;" +
    "\n;captured.TEMPLATE_CANONICAL_DISTS = TEMPLATE_CANONICAL_DISTS;" +
    "\n;captured.parseIntervalSecs = parseIntervalSecs;",
);
runner(captured);

const { TEMPLATE_ENGINE, TEMPLATE_CANONICAL_DISTS, parseIntervalSecs } = captured;

// ─── validation ──────────────────────────────────────────────────────────────
function validateOption(opt, template, ctx) {
  const errs = [];
  if (!opt) { errs.push("null output"); return errs; }
  if (!opt.label) errs.push("missing label");
  if (typeof opt.totalYards !== "number" || opt.totalYards <= 0) errs.push(`bad totalYards: ${opt.totalYards}`);
  if (!Array.isArray(opt.sets) || opt.sets.length === 0) { errs.push("missing/empty sets"); return errs; }
  const computedYards = opt.sets.reduce((sum, s) => sum + (s.reps || 1) * (s.dist || 0), 0);
  if (computedYards !== opt.totalYards) errs.push(`totalYards mismatch: declared=${opt.totalYards} computed=${computedYards}`);
  // Spec V1: ±5% of budget
  if (ctx?.budget) {
    const pctOff = Math.abs(opt.totalYards - ctx.budget) / ctx.budget;
    if (pctOff > 0.05) errs.push(`budget overshoot: ${opt.totalYards}yd vs budget ${ctx.budget}yd (${(pctOff*100).toFixed(1)}% off, spec allows ±5%)`);
  }
  for (const [i, s] of opt.sets.entries()) {
    if (!s.dist || !TEMPLATE_CANONICAL_DISTS.includes(s.dist)) errs.push(`set[${i}] dist=${s.dist} not canonical`);
    if (typeof s.reps !== "number" || s.reps < 1) errs.push(`set[${i}] bad reps=${s.reps}`);
    if (!s.desc || s.desc.trim() === "") errs.push(`set[${i}] empty desc`);
    if (!s.focus || s.focus.trim() === "") errs.push(`set[${i}] empty focus`);
    if (!s.interval) errs.push(`set[${i}] missing interval`);
    else {
      const secs = parseIntervalSecs(s.interval);
      if (secs === null) errs.push(`set[${i}] unparseable interval: ${s.interval}`);
      else if (secs < 30 || secs > 3600) errs.push(`set[${i}] interval out of range: ${secs}s`);
    }
  }
  return errs;
}

function printOption(opt, header, errs) {
  console.log(`\n  ── ${header} ──`);
  if (!opt) { console.log("    NULL"); return; }
  console.log(`    label:      ${opt.label}`);
  console.log(`    totalYards: ${opt.totalYards}`);
  for (const [i, s] of opt.sets.entries()) {
    console.log(`    set[${i}]: ${s.reps}×${s.dist}  ${s.interval}`);
    console.log(`              desc:  ${s.desc}`);
    console.log(`              focus: ${s.focus}`);
  }
  if (errs.length) {
    console.log(`    !! VALIDATION ERRORS: ${errs.length}`);
    for (const e of errs) console.log(`       - ${e}`);
  }
}

// ─── sample matrix ───────────────────────────────────────────────────────────
const TEST_MATRIX = [
  // (templateId, typeKey, budgetYd, label)
  // ── S1 templates ──
  ["aerobic_volume",     "distance",  1200, "distance / 1200yd"],
  ["aerobic_volume",     "endurance", 1500, "endurance / 1500yd"],
  ["aerobic_volume",     "im",        1200, "im / 1200yd"],
  ["aerobic_volume",     "free",       800, "free / 800yd"],
  ["aerobic_volume",     "mixed",     1000, "mixed / 1000yd"],

  ["descend_ladder",     "distance",  1000, "distance / 1000yd"],
  ["descend_ladder",     "sprint",     400, "sprint / 400yd"],
  ["descend_ladder",     "free",       800, "free / 800yd"],
  ["descend_ladder",     "fly",        400, "fly / 400yd"],
  ["descend_ladder",     "im",         800, "im / 800yd"],

  ["block_with_recovery", "distance", 1200, "distance / 1200yd"],
  ["block_with_recovery", "sprint",    800, "sprint / 800yd"],
  ["block_with_recovery", "endurance",1400, "endurance / 1400yd"],
  ["block_with_recovery", "im",       1200, "im / 1200yd"],
  ["block_with_recovery", "back",     1000, "back / 1000yd"],

  // ── S2 templates ──
  ["main_plus_finisher", "distance",  1200, "distance / 1200yd"],
  ["main_plus_finisher", "sprint",     800, "sprint / 800yd"],
  ["main_plus_finisher", "endurance", 1400, "endurance / 1400yd"],
  ["main_plus_finisher", "im",        1200, "im / 1200yd"],
  ["main_plus_finisher", "free",      1000, "free / 1000yd"],

  ["stroke_rotation",    "im",        1200, "im / 1200yd"],
  ["stroke_rotation",    "mixed",     1000, "mixed / 1000yd"],

  ["sandwich",           "distance",  1200, "distance / 1200yd"],
  ["sandwich",           "endurance", 1400, "endurance / 1400yd"],
  ["sandwich",           "im",        1200, "im / 1200yd"],
  ["sandwich",           "fly",        600, "fly / 600yd"],

  ["repeat_unit",        "distance",  1200, "distance / 1200yd"],
  ["repeat_unit",        "endurance", 1500, "endurance / 1500yd"],
  ["repeat_unit",        "im",        1200, "im / 1200yd"],
  ["repeat_unit",        "free",       800, "free / 800yd"],

  ["drill_progression",  "im",         800, "im / 800yd"],
  ["drill_progression",  "free",       400, "free / 400yd"],
  ["drill_progression",  "back",       400, "back / 400yd"],
  ["drill_progression",  "fly",        300, "fly / 300yd"],

  ["build_within_rep",   "distance",  1200, "distance / 1200yd"],
  ["build_within_rep",   "endurance", 1000, "endurance / 1000yd"],
  ["build_within_rep",   "free",       800, "free / 800yd"],
  ["build_within_rep",   "im",        1000, "im / 1000yd"],

  ["threshold_steady",   "distance",  1200, "distance / 1200yd"],
  ["threshold_steady",   "endurance", 1500, "endurance / 1500yd"],
  ["threshold_steady",   "im",        1200, "im / 1200yd"],
  ["threshold_steady",   "free",      1000, "free / 1000yd"],

  ["race_day_simulation", "sprint",    400, "sprint / 400yd"],
  ["race_day_simulation", "distance", 1500, "distance / 1500yd"],
  ["race_day_simulation", "mixed",    1000, "mixed / 1000yd"],
  ["race_day_simulation", "im",       1200, "im / 1200yd"],

  ["pyramid_up_down",    "distance",  1500, "distance / 1500yd"],
  ["pyramid_up_down",    "sprint",     400, "sprint / 400yd"],
  ["pyramid_up_down",    "endurance", 1400, "endurance / 1400yd"],
  ["pyramid_up_down",    "free",       800, "free / 800yd"],
  ["pyramid_up_down",    "im",        1200, "im / 1200yd"],
  ["pyramid_up_down",    "back",       800, "back / 800yd"],
];

const args = process.argv.slice(2);
const flag = (k, def=null) => { const i = args.indexOf(k); return i >= 0 ? args[i+1] : def; };
const onlyTemplate = flag("--template");
const batch = parseInt(flag("--batch", "0"), 10);

let totalGen = 0, totalErrs = 0;

if (batch > 0) {
  // Stress-test: generate N samples of each, count errors
  console.log(`Batch mode: ${batch} per (template, type)`);
  for (const tplId of TEMPLATE_ENGINE.list()) {
    if (onlyTemplate && tplId !== onlyTemplate) continue;
    for (const [, typeKey, budget] of TEST_MATRIX.filter(r => r[0] === tplId)) {
      let errCount = 0;
      for (let i = 0; i < batch; i++) {
        const opt = TEMPLATE_ENGINE.generate(tplId, typeKey, "main", budget);
        const errs = validateOption(opt, tplId, { typeKey, budget });
        if (errs.length) errCount++;
        totalGen++;
        totalErrs += errs.length;
      }
      console.log(`  ${tplId.padEnd(22)} ${typeKey.padEnd(10)} budget=${budget}  errors: ${errCount}/${batch}`);
    }
  }
  console.log(`\nTotal: ${totalGen} generated, ${totalErrs} validation errors`);
  process.exit(totalErrs > 0 ? 1 : 0);
}

// Default: print one sample per (template, type, budget) for coach review
console.log("Template engine — sample output matrix");
console.log("(deterministic via seeded random would be S3; for now Math.random)\n");
for (const [tplId, typeKey, budget, label] of TEST_MATRIX) {
  if (onlyTemplate && tplId !== onlyTemplate) continue;
  if (!TEMPLATE_ENGINE.list().includes(tplId)) { console.log(`\n[skip] ${tplId} not registered`); continue; }
  console.log(`\n=== ${tplId} :: ${label} ===`);
  const opt = TEMPLATE_ENGINE.generate(tplId, typeKey, "main", budget);
  const errs = validateOption(opt, tplId, { typeKey, budget });
  printOption(opt, label, errs);
  totalGen++;
  totalErrs += errs.length;
}
console.log(`\n${totalGen} samples generated, ${totalErrs} validation errors`);

// ─── S2.5 — validator + retry + anti-repeat tests ────────────────────────────
// These don't run in batch mode (--batch exits earlier). They verify the
// validator catches known-bad outputs, retry retries, and anti-repeat
// exclusion fires correctly.
console.log("\n\n── S2.5: validator + retry + anti-repeat tests ──");
const s25Failures = [];
const assertS25 = (name, cond, detail = "") => {
  if (cond) console.log(`  PASS  ${name}`);
  else { console.log(`  FAIL  ${name}  ${detail}`); s25Failures.push(name); }
};

// T1: validator catches missing focus (V8)
{
  const bad = { label: "x", totalYards: 100, sets: [{ reps: 1, dist: 100, desc: "x", interval: "On 2:30", focus: "" }] };
  const errs = TEMPLATE_ENGINE.validate(bad, { budgetYd: 100 });
  assertS25("V8: empty focus flagged", errs.some(e => e.code === "V8"), JSON.stringify(errs));
}

// T2: validator catches non-canonical dist (V2)
{
  const bad = { label: "x", totalYards: 125, sets: [{ reps: 1, dist: 125, desc: "x", interval: "On 3:00", focus: "x" }] };
  const errs = TEMPLATE_ENGINE.validate(bad, { budgetYd: 125 });
  assertS25("V2: non-canonical dist flagged", errs.some(e => e.code === "V2"), JSON.stringify(errs));
}

// T3: validator catches interval-too-tight (V4)
{
  // 100yd at baseline pace = 120s swim. Interval of 1:00 = 60s — way too tight.
  const bad = { label: "x", totalYards: 100, sets: [{ reps: 1, dist: 100, desc: "x", interval: "On 1:00", focus: "x" }] };
  const errs = TEMPLATE_ENGINE.validate(bad, { budgetYd: 100 });
  assertS25("V4: interval shorter than swim time flagged", errs.some(e => e.code === "V4"), JSON.stringify(errs));
}

// T4: validator catches budget overshoot (V1)
{
  const bad = { label: "x", totalYards: 1500, sets: [{ reps: 1, dist: 500, desc: "x", interval: "On 11:00", focus: "x" }, { reps: 1, dist: 500, desc: "x", interval: "On 11:00", focus: "x" }, { reps: 1, dist: 500, desc: "x", interval: "On 11:00", focus: "x" }] };
  const errs = TEMPLATE_ENGINE.validate(bad, { budgetYd: 1000 });
  assertS25("V1: budget overshoot flagged", errs.some(e => e.code === "V1"), JSON.stringify(errs));
}

// T5: validator catches eq=pull without pull cue (V6)
{
  const bad = { label: "x", totalYards: 100, sets: [{ reps: 1, dist: 100, desc: "Freestyle moderate", interval: "On 2:30", focus: "x", eq: "pull" }] };
  const errs = TEMPLATE_ENGINE.validate(bad, { budgetYd: 100 });
  assertS25("V6: eq=pull without pull/paddle/buoy flagged", errs.some(e => e.code === "V6"), JSON.stringify(errs));
}

// T6: real engine output passes validator
{
  const opt = TEMPLATE_ENGINE.generate("aerobic_volume", "distance", "main", 1200);
  const errs = TEMPLATE_ENGINE.validate(opt, { budgetYd: 1200 });
  assertS25("real engine output passes validator", errs.length === 0, JSON.stringify(errs));
}

// T7: generateWithRetry returns option + templateUsed on success
{
  const r = TEMPLATE_ENGINE.generateWithRetry({
    templateId: "aerobic_volume", typeKey: "distance", section: "main", budgetYd: 1200,
  });
  assertS25("generateWithRetry success: returns option", r.option != null);
  assertS25("generateWithRetry success: templateUsed = requested", r.templateUsed === "aerobic_volume");
  assertS25("generateWithRetry success: attempts ≥ 1", r.attempts.length >= 1);
}

// T8: anti-repeat skips requested template if in recent[]
{
  const r = TEMPLATE_ENGINE.generateWithRetry({
    templateId: "aerobic_volume", typeKey: "distance", section: "main", budgetYd: 1200,
    recent: [{ template_id: "aerobic_volume", stroke: "free", ts: Date.now() }],
  });
  // Should skip the original (excluded) and go straight to a different template
  assertS25("anti-repeat: skipped excluded template",
    r.templateUsed !== "aerobic_volume" && r.option != null,
    `templateUsed=${r.templateUsed}`);
}

// T9: anti-repeat fallback — all templates excluded → null
{
  const allTemplateExclusions = TEMPLATE_ENGINE.list().map(id => ({ template_id: id, stroke: "free", ts: 0 }));
  const r = TEMPLATE_ENGINE.generateWithRetry({
    templateId: "aerobic_volume", typeKey: "distance", section: "main", budgetYd: 1200,
    recent: allTemplateExclusions,
  });
  assertS25("anti-repeat full exhaustion: returns null option (bank fallback)",
    r.option === null && r.templateUsed === null,
    `templateUsed=${r.templateUsed}`);
}

// T10: unknown template → null with attempts including alternative
{
  const r = TEMPLATE_ENGINE.generateWithRetry({
    templateId: "nonexistent_template", typeKey: "distance", section: "main", budgetYd: 1200,
  });
  // Original attempts fail with V0, then attempt 3 picks a real alternative which should succeed
  assertS25("unknown template: alt picked", r.option != null && r.templateUsed !== "nonexistent_template",
    `templateUsed=${r.templateUsed}, attempts=${JSON.stringify(r.attempts)}`);
}

console.log(`\nS2.5: ${s25Failures.length === 0 ? "all tests passed" : `${s25Failures.length} failures: ${s25Failures.join(", ")}`}`);

process.exit(totalErrs > 0 || s25Failures.length > 0 ? 1 : 0);
