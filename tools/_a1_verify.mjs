// _a1_verify.mjs — TEMP harness to prove the A1 generateWorkout refactor is
// byte-identical. Extracts the babel script, captures generateWorkout, seeds
// Math.random per config for determinism, snapshots blocks over a matrix.
// Usage: node tools/_a1_verify.mjs > /tmp/a1_snap.json   (diff before/after)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, "..", "public", "index.html"), "utf8");
const lines = html.split("\n");
const start = lines.findIndex(l => /<script\s+type="text\/babel">/.test(l));
const end   = lines.findIndex(l => /^\s*function EquipmentBadge\b/.test(l));
const extracted = lines.slice(start + 1, end).join("\n");

globalThis.React = { useState: () => [null, () => {}], useCallback: (f) => f, useMemo: (f) => f(), useEffect: () => {}, useRef: () => ({ current: null }) };
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.window = globalThis;

const captured = {};
new Function("captured", extracted +
  "\n;captured.generateWorkout = generateWorkout;" +
  "\n;captured.WORKOUT_TYPES = WORKOUT_TYPES;"
)(captured);
const { generateWorkout, WORKOUT_TYPES } = captured;

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const typeIds  = WORKOUT_TYPES.map(t => t.id);
const pools    = ["25y","25m","50m"];
const budgets  = [2000, 3000, 4000];
const biases   = ["balanced","warmup_heavy","drill_heavy","long_main"];

const snap = [];
let seedN = 1;
for (const typeId of typeIds) for (const poolMode of pools) for (const maxYards of budgets) for (const sectionBias of biases) {
  globalThis.Math.random = mulberry32(1000 + (seedN++));   // deterministic per config
  let res;
  try { res = generateWorkout({ typeId, maxYards, equipment: {}, poolMode, sectionBias }); }
  catch (e) { res = { __error: String(e && e.message || e) }; }
  const digest = (res && res.blocks)
    ? res.blocks.map(b => `${b.section}|${b.label||b.name||""}|${b.totalYards}|${(b.sets||[]).length}`).join("  ;  ")
    : (res && res.__generateFailure ? `FAIL:${res.reason}` : (res && res.__error ? `ERR:${res.__error}` : "NULL"));
  snap.push(`${typeId}/${poolMode}/${maxYards}/${sectionBias} => ${digest}`);
}
console.log(snap.join("\n"));
