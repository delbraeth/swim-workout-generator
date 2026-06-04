// tools/engine_closure.mjs — analyze whether the workout engine is cleanly separable
// from src/app.jsx's prelude, for a true src/lib/engine.js (retiring the vm in lib/generator.js).
//
// Builds the dependency graph of top-level declarations in src/app.jsx, computes the
// transitive closure from the engine roots, and flags any browser-global references inside
// that closure (which would break a direct Node import). Read-only; prints a report.

import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire("/tmp/babelcheck/package.json");
const parser = require("@babel/parser");

const code = fs.readFileSync("src/app.jsx", "utf8");
const ast = parser.parse(code, { sourceType: "module", plugins: ["jsx"], errorRecovery: true });

const ROOTS = ["generateWorkout", "regenerateSection", "WORKOUT_TYPES"];
const BROWSER = new Set(["React","ReactDOM","window","document","navigator","fetch","localStorage","sessionStorage","location","history","alert","confirm","prompt","requestAnimationFrame","AudioContext","webkitAudioContext","matchMedia","getComputedStyle","Image","Audio","Blob","FormData","URL","crypto"]);

// 1) Collect top-level declarations: name -> {node, line}.
const top = new Map();
function patternNames(node, out) {
  if (!node) return;
  if (node.type === "Identifier") out.push(node.name);
  else if (node.type === "ObjectPattern") node.properties.forEach(p => patternNames(p.value || p.argument, out));
  else if (node.type === "ArrayPattern") node.elements.forEach(e => patternNames(e, out));
  else if (node.type === "AssignmentPattern") patternNames(node.left, out);
  else if (node.type === "RestElement") patternNames(node.argument, out);
}
for (let n of ast.program.body) {
  if (n.type === "ExportNamedDeclaration" && n.declaration) n = n.declaration; // unwrap `export ...`
  if (n.type === "FunctionDeclaration" && n.id) top.set(n.id.name, { node: n, line: n.loc.start.line });
  else if (n.type === "VariableDeclaration") {
    for (const d of n.declarations) {
      const names = []; patternNames(d.id, names);
      for (const nm of names) top.set(nm, { node: d.init || d, line: (d.loc || n.loc).start.line });
    }
  }
}
const T = new Set(top.keys());

// 2) For each top-level decl, collect referenced identifiers (Identifier + uppercase JSX).
function refsOf(node) {
  const refs = new Set();
  (function walk(n, parent, key) {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "Identifier") {
      const skip = ((parent.type === "MemberExpression" || parent.type === "OptionalMemberExpression") && key === "property" && !parent.computed) ||
        ((parent.type === "ObjectProperty" || parent.type === "Property") && key === "key" && !parent.computed);
      if (!skip) refs.add(n.name);
      return;
    }
    if (n.type === "JSXIdentifier") { if (/^[A-Z]/.test(n.name)) refs.add(n.name); return; }
    for (const k in n) {
      if (k === "loc" || k.endsWith("Comments")) continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(c => walk(c, n, k));
      else if (v && typeof v.type === "string") walk(v, n, k);
    }
  })(node, { type: "x" }, "");
  return refs;
}
const edges = new Map();      // name -> Set(top-level names it references)
const browserRefs = new Map(); // name -> Set(browser globals it references)
for (const [name, { node }] of top) {
  const r = refsOf(node);
  const dep = new Set(), br = new Set();
  for (const x of r) { if (T.has(x) && x !== name) dep.add(x); if (BROWSER.has(x)) br.add(x); }
  edges.set(name, dep); browserRefs.set(name, br);
}

// 3) BFS closure from roots.
const closure = new Set(); const queue = [...ROOTS];
const missingRoots = ROOTS.filter(r => !T.has(r));
while (queue.length) {
  const c = queue.shift();
  if (closure.has(c) || !T.has(c)) continue;
  closure.add(c);
  for (const d of (edges.get(c) || [])) if (!closure.has(d)) queue.push(d);
}

// 4) Report.
const EQB = (code.split("\n").findIndex(l => /^\s*function EquipmentBadge\b/.test(l))) + 1;
const inPrelude = [...closure].filter(n => top.get(n).line < EQB);
const afterPrelude = [...closure].filter(n => top.get(n).line >= EQB);
const withBrowser = [...closure].filter(n => (browserRefs.get(n) || new Set()).size > 0);

console.log(`engine roots: ${ROOTS.join(", ")}${missingRoots.length ? "  MISSING: " + missingRoots.join(",") : ""}`);
console.log(`top-level decls in file: ${T.size}`);
console.log(`EquipmentBadge boundary: line ${EQB}`);
console.log(`\nClosure size: ${closure.size} symbols  (${inPrelude.length} in prelude, ${afterPrelude.length} after boundary)`);
if (afterPrelude.length) console.log(`  ⚠ closure reaches AFTER the boundary: ${afterPrelude.slice(0,20).join(", ")}`);
console.log(`\nClosure members referencing BROWSER globals (would block clean Node import): ${withBrowser.length}`);
for (const n of withBrowser.slice(0, 40)) console.log(`  ${n} (line ${top.get(n).line}): ${[...browserRefs.get(n)].join(", ")}`);
// Rough line span of closure (sum is not contiguous; report min/max prelude line touched)
const lines = inPrelude.map(n => top.get(n).line).sort((a,b)=>a-b);
if (lines.length) console.log(`\nPrelude closure spans lines ~${lines[0]}..${lines[lines.length-1]}`);
if (process.env.LIST) {
  console.log("\nClosure symbols (by line):");
  [...closure].map(n => [top.get(n).line, n]).sort((a,b)=>a[0]-b[0]).forEach(([l,n]) => console.log(`  ${String(l).padStart(5)}  ${n}`));
}
