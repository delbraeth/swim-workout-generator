// measure_fallback_rate.mjs — measure how often the engine falls back to
// the bank across the full (typeId × section × budget) matrix.
//
// Fallback happens when:
//   (a) TEMPLATE_ENGINE.applicable(section, typeId) returns empty, OR
//   (b) generateWithRetry exhausts attempts (validator fails 3x).
//
// Both yield option:null from generateEngineForSection. The bank picker's
// engine-override path then silently keeps the bank-picked option.
//
// Per-cell sample: N attempts per (type, section, budget). Failure rate
// per cell = (cells where option === null) / N.
//
// Usage: node tools/measure_fallback_rate.mjs [--samples 20]
//
// Output: matrix per cell + overall rate.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_PATH = path.join(__dirname, "..", "public", "index.html");

const SAMPLES_FLAG = process.argv.indexOf("--samples");
const SAMPLES = SAMPLES_FLAG > -1 ? Number(process.argv[SAMPLES_FLAG + 1]) : 20;

const html = fs.readFileSync(HTML_PATH, "utf8");
const lines = html.split("\n");
const startMarker = lines.findIndex(l => /<script\s+type="text\/babel">/.test(l));
const endMarker   = lines.findIndex(l => /^\s*function EquipmentBadge\b/.test(l));
const extracted = lines.slice(startMarker + 1, endMarker).join("\n");

globalThis.React = { useState: () => [null, () => {}], useCallback: (f) => f, useMemo: (f) => f(), useEffect: () => {} };
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const captured = {};
const runner = new Function(
  "captured",
  extracted +
    "\n;captured.TEMPLATE_ENGINE = TEMPLATE_ENGINE;" +
    "\n;captured.templateDefaultStroke = templateDefaultStroke;",
);
runner(captured);

const { TEMPLATE_ENGINE, templateDefaultStroke } = captured;

// Matrix
const TYPES = ["distance", "sprint", "endurance", "mixed", "free", "back", "breast", "fly", "im"];
const SECTIONS = ["warmup", "drill", "main", "cooldown"];
// Per-section budget ranges (yards). Reflects realistic picker output sizes.
const BUDGETS = {
  warmup:   [300, 400, 500, 600, 700],
  drill:    [300, 400, 500, 600, 700, 800],
  main:     [600, 800, 1000, 1200, 1400, 1600, 1800, 2000],
  cooldown: [200, 300, 400, 500],
};

// Simulate generateEngineForSection's "pick a template, generate with retry"
// — minus the picker's weight stuff (no engineDisfavorites in this sim).
function tryCell(section, typeId, budgetYd) {
  const applicable = TEMPLATE_ENGINE.applicable(section, typeId);
  if (!applicable.length) return { ok: false, reason: "no-applicable-template" };
  // Pick uniformly random among applicable (same as Math.random() of size N)
  const tpl = applicable[Math.floor(Math.random() * applicable.length)];
  const stroke = templateDefaultStroke(typeId);
  const res = TEMPLATE_ENGINE.generateWithRetry({
    templateId: tpl.id, typeKey: typeId, section, budgetYd, recent: [],
  });
  if (res && res.option) return { ok: true, templateUsed: res.templateUsed };
  return { ok: false, reason: "validator-exhausted", attempts: res ? res.attempts : null };
}

const results = [];
let totalCells = 0, totalSamples = 0, totalFailures = 0;

for (const section of SECTIONS) {
  for (const typeId of TYPES) {
    for (const budget of BUDGETS[section]) {
      let fails = 0;
      let noApplicable = 0;
      let validatorExhausted = 0;
      for (let i = 0; i < SAMPLES; i++) {
        const r = tryCell(section, typeId, budget);
        if (!r.ok) {
          fails++;
          if (r.reason === "no-applicable-template") noApplicable++;
          else validatorExhausted++;
        }
      }
      totalCells++;
      totalSamples += SAMPLES;
      totalFailures += fails;
      const rate = fails / SAMPLES;
      results.push({ section, typeId, budget, fails, samples: SAMPLES, rate, noApplicable, validatorExhausted });
    }
  }
}

// Sort by failure rate desc, then by section
results.sort((a, b) => b.rate - a.rate || a.section.localeCompare(b.section));

console.log(`\nFallback measurement — ${SAMPLES} samples per cell, ${totalCells} cells, ${totalSamples} total samples.\n`);
console.log(`Overall fallback rate: ${(totalFailures / totalSamples * 100).toFixed(1)}% (${totalFailures}/${totalSamples})\n`);

console.log("Worst cells (≥20% fallback rate):");
console.log(" section    type        budget   rate    fails/samples  why");
for (const r of results.filter(r => r.rate >= 0.20)) {
  const reason = r.noApplicable === r.fails ? "no-applicable" : r.validatorExhausted === r.fails ? "validator-exhausted" : `mixed (${r.noApplicable}na, ${r.validatorExhausted}ve)`;
  console.log(` ${r.section.padEnd(10)} ${r.typeId.padEnd(11)} ${String(r.budget).padStart(5)}    ${(r.rate * 100).toFixed(0).padStart(3)}%    ${String(r.fails).padStart(3)}/${r.samples}        ${reason}`);
}

console.log("\nPer-section summary:");
for (const section of SECTIONS) {
  const cells = results.filter(r => r.section === section);
  const failed = cells.reduce((s, r) => s + r.fails, 0);
  const total = cells.reduce((s, r) => s + r.samples, 0);
  console.log(` ${section.padEnd(10)} ${(failed / total * 100).toFixed(1)}% fallback (${failed}/${total} samples)`);
}

console.log("\nPer-type summary:");
for (const typeId of TYPES) {
  const cells = results.filter(r => r.typeId === typeId);
  const failed = cells.reduce((s, r) => s + r.fails, 0);
  const total = cells.reduce((s, r) => s + r.samples, 0);
  console.log(` ${typeId.padEnd(11)} ${(failed / total * 100).toFixed(1)}% fallback (${failed}/${total} samples)`);
}
