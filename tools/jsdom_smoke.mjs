// tools/jsdom_smoke.mjs — SPA bundle render smoke test.
//
// Loads React (UMD, from devDeps) + the built esbuild bundle (public/assets/app.js)
// into a jsdom DOM, mounts <App/>, and asserts the root rendered with zero runtime
// errors. This is the one-command "did the bundle still mount?" check for every
// Phase-3 component-split slice — the closest we get to a browser locally (no
// runnable local server; the preview tool's headless renderer doesn't exec scripts).
//
// Usage:  npm run build && node tools/jsdom_smoke.mjs
// Exits 0 on success, 1 on any render error / empty root.
//
// NOTE: jsdom is not a browser. It proves the bundle *evaluates + mounts the
// unauthenticated App* (sign-in / landing path) without throwing. Authenticated
// views still need a real-browser eyeball on setforge.io before/after deploy.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { JSDOM } from "jsdom";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function readReactUmd(pkg, file) {
  // Resolve the package's own dir, then read its UMD build.
  const pkgJson = require.resolve(`${pkg}/package.json`);
  return fs.readFileSync(path.join(path.dirname(pkgJson), "umd", file), "utf8");
}

const react = readReactUmd("react", "react.development.js");
const reactDom = readReactUmd("react-dom", "react-dom.development.js");

// The prod bundle is ESM + code-split (can't inject as a classic <script>). Build a
// throwaway IIFE bundle from the same entry (dynamic imports inline) just for this
// mount sanity check — format-independent, exercises the real component tree.
import { execSync } from "node:child_process";
const bundlePath = "/tmp/smoke-bundle.js";
execSync(
  `npx esbuild src/main.jsx --bundle --format=iife ` +
  `--jsx=transform --jsx-factory=React.createElement --jsx-fragment=React.Fragment ` +
  `--target=es2019 --outfile=${bundlePath}`,
  { cwd: ROOT, stdio: ["ignore", "ignore", "ignore"] }   // relative entry — ROOT path has spaces
);
const app = fs.readFileSync(bundlePath, "utf8");

const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>`, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  url: "https://setforge.io/",
});
const { window } = dom;

// Browser globals the SPA touches that jsdom doesn't provide.
window.__BUILD_ID__ = "jsdom-smoke";
if (!window.matchMedia) {
  window.matchMedia = () => ({ matches: false, media: "", addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
}
window.scrollTo = window.scrollTo || function () {};
// Stub fetch so mount-time auth/network calls resolve harmlessly (unauthenticated).
window.fetch = () => Promise.resolve({
  ok: false, status: 401,
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(""),
  headers: { get: () => null },
});

const errors = [];
window.addEventListener("error", (e) => errors.push(String((e.error && e.error.stack) || e.message)));
window.onerror = (m, s, l, c, err) => { errors.push(String((err && err.stack) || m)); };
window.addEventListener("unhandledrejection", (e) => errors.push("UNHANDLED_REJECTION: " + String(e.reason && (e.reason.stack || e.reason))));

function inject(code, label) {
  try {
    const s = window.document.createElement("script");
    s.textContent = code;
    window.document.body.appendChild(s);
  } catch (e) {
    errors.push(`${label} THREW: ${e.stack || e}`);
  }
}

inject(react, "react");
inject(reactDom, "react-dom");
if (typeof window.React !== "object" || !(window.ReactDOM && window.ReactDOM.createRoot)) {
  console.error("✗ React/ReactDOM UMD failed to load into jsdom.");
  process.exit(1);
}
inject(app, "app.js");

// Give React a tick to mount + run initial effects.
setTimeout(() => {
  const root = window.document.getElementById("root");
  const len = root ? root.innerHTML.length : -1;
  const ok = errors.length === 0 && len > 200;
  console.log(`root.innerHTML length: ${len}`);
  console.log(`runtime errors: ${errors.length}`);
  errors.slice(0, 10).forEach((e, i) => console.log(`  [${i}] ${e.slice(0, 400)}`));
  if (ok) {
    console.log("✓ jsdom smoke PASS — bundle mounts <App/> cleanly.");
    process.exit(0);
  }
  console.error("✗ jsdom smoke FAIL — empty root or runtime error(s).");
  process.exit(1);
}, 1500);
