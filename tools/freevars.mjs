// tools/freevars.mjs — static free-variable checker for extracted SPA modules.
//
// Parses each module (JSX) and reports identifiers that are REFERENCED but neither
// declared anywhere in the module, imported, nor a known runtime global. After a
// component is carved out of src/app.jsx, any such name is a bug: esbuild leaves it
// as an undefined runtime global (no build error) and it crashes when that code path
// renders. This catches them on ALL paths (unlike render tests / the App smoke).
//
// Usage: node tools/freevars.mjs [file ...]   (default: src/components/**/*.jsx)
// Exit 0 = clean, 1 = free vars found.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire("/tmp/babelcheck/package.json");
const parser = require("@babel/parser");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const GLOBALS = new Set([
  "React","ReactDOM","ReactDOMServer","window","document","navigator","location","history",
  "console","fetch","Math","Number","String","Boolean","Object","Array","JSON","Date","Promise",
  "Set","Map","WeakMap","WeakSet","Symbol","RegExp","Error","TypeError","RangeError","Proxy","Reflect",
  "parseInt","parseFloat","isNaN","isFinite","encodeURIComponent","decodeURIComponent","encodeURI","decodeURI",
  "setTimeout","clearTimeout","setInterval","clearInterval","requestAnimationFrame","cancelAnimationFrame",
  "localStorage","sessionStorage","alert","confirm","prompt","URL","URLSearchParams","Blob","File","FileReader",
  "FormData","Headers","Request","Response","AudioContext","webkitAudioContext","atob","btoa","structuredClone",
  "crypto","TextEncoder","TextDecoder","undefined","NaN","Infinity","globalThis","performance","Intl","BigInt",
  "Uint8Array","Uint16Array","Uint32Array","Int8Array","Float32Array","Float64Array","ArrayBuffer","DataView",
  "IntersectionObserver","ResizeObserver","MutationObserver","queueMicrotask","getComputedStyle","DOMParser",
  "Image","Audio","Notification","AbortController","Event","CustomEvent","HTMLElement","Node","clearImmediate",
  "print","scrollTo","matchMedia","CSS","DataTransfer","ClipboardEvent","KeyboardEvent","MouseEvent",
]);

function parse(code) {
  return parser.parse(code, { sourceType: "module", plugins: ["jsx"], errorRecovery: true });
}

// Collect all binding names from a pattern (params, var ids).
function collectPattern(node, declared) {
  if (!node) return;
  switch (node.type) {
    case "Identifier": declared.add(node.name); break;
    case "ObjectPattern": node.properties.forEach(p => collectPattern(p.value || p.argument, declared)); break;
    case "ArrayPattern": node.elements.forEach(e => collectPattern(e, declared)); break;
    case "AssignmentPattern": collectPattern(node.left, declared); break;
    case "RestElement": collectPattern(node.argument, declared); break;
  }
}

function check(file) {
  const code = fs.readFileSync(file, "utf8");
  const ast = parse(code);
  const declared = new Set();
  const refs = new Map(); // name -> first line

  // Pass 1: collect every name DECLARED anywhere in the module (any scope). For
  // free-var detection, "declared anywhere in the file" ⇒ not a free var.
  (function walkDecl(n) {
    if (!n || typeof n.type !== "string") return;
    switch (n.type) {
      case "ImportDefaultSpecifier":
      case "ImportNamespaceSpecifier":
      case "ImportSpecifier": declared.add(n.local.name); return;
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
      case "ObjectMethod":
      case "ClassMethod":
        if (n.id) declared.add(n.id.name);
        (n.params || []).forEach(p => collectPattern(p, declared));
        break;
      case "VariableDeclarator": collectPattern(n.id, declared); break;
      case "ClassDeclaration":
      case "ClassExpression": if (n.id) declared.add(n.id.name); break;
      case "CatchClause": if (n.param) collectPattern(n.param, declared); break;
    }
    for (const k in n) {
      if (k === "loc" || k === "leadingComments" || k === "trailingComments") continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(walkDecl);
      else if (v && typeof v.type === "string") walkDecl(v);
    }
  })(ast.program);

  // Pass 2: collect REFERENCES (identifiers in value position + uppercase JSX names).
  (function walkRef(n, parent, key) {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "Identifier") {
      // Skip non-reference identifier positions.
      const skip =
        (parent.type === "MemberExpression" && key === "property" && !parent.computed) ||
        (parent.type === "OptionalMemberExpression" && key === "property" && !parent.computed) ||
        ((parent.type === "ObjectProperty" || parent.type === "ObjectMethod" || parent.type === "Property") && key === "key" && !parent.computed) ||
        ((parent.type === "ClassMethod" || parent.type === "ClassProperty") && key === "key" && !parent.computed) ||
        (parent.type === "LabeledStatement" || parent.type === "BreakStatement" || parent.type === "ContinueStatement");
      if (!skip && !refs.has(n.name)) refs.set(n.name, n.loc ? n.loc.start.line : 0);
      return;
    }
    if (n.type === "JSXIdentifier") {
      // Skip the `.Property` of a JSXMemberExpression (e.g. React.Suspense) — only the
      // root object (React) is a real reference; the property rides on it.
      if (parent.type === "JSXMemberExpression" && key === "property") return;
      // Only Capitalized JSX names are component refs (lowercase = host tags).
      if (parent.type === "JSXOpeningElement" || parent.type === "JSXClosingElement" || parent.type === "JSXMemberExpression") {
        if (/^[A-Z]/.test(n.name) && !refs.has(n.name)) refs.set(n.name, n.loc ? n.loc.start.line : 0);
      }
      return;
    }
    // Don't descend into binding-only positions to avoid counting them as refs,
    // but DO descend into defaults/inits (handled naturally since those are other keys).
    for (const k in n) {
      if (k === "loc" || k === "leadingComments" || k === "trailingComments") continue;
      // Skip the property name of non-computed member access and object keys.
      if ((n.type === "MemberExpression" || n.type === "OptionalMemberExpression") && k === "property" && !n.computed) continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach(c => walkRef(c, n, k));
      else if (v && typeof v.type === "string") walkRef(v, n, k);
    }
  })(ast.program, { type: "Program" }, "program");

  const free = [];
  for (const [name, line] of refs) {
    if (!declared.has(name) && !GLOBALS.has(name)) free.push({ name, line });
  }
  free.sort((a, b) => a.name.localeCompare(b.name));
  return free;
}

// Resolve file list.
let files = process.argv.slice(2);
if (files.length === 0) {
  const dir = path.join(ROOT, "src", "components");
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : (p.endsWith(".jsx") ? [p] : []);
  });
  files = fs.existsSync(dir) ? walk(dir) : [];
}

let total = 0;
for (const f of files) {
  const free = check(f);
  const rel = path.relative(ROOT, f);
  if (free.length) {
    total += free.length;
    console.log(`✗ ${rel}`);
    for (const { name, line } of free) console.log(`    ${name}  (first ref line ${line})`);
  } else {
    console.log(`✓ ${rel}`);
  }
}
console.log(total === 0 ? "\n✓ no free variables." : `\n✗ ${total} free reference(s) across modules.`);
process.exit(total === 0 ? 0 : 1);
