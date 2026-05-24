#!/usr/bin/env node
/**
 * sync_bank.mjs — Bank ↔ DB sync CLI (UGC Phase A+B).
 *
 * Spec: UGC_COACH_SETS_SCOPE.md §2 (hybrid DB+JS-export architecture).
 *
 * Thin CLI wrapper around tools/bank_importer.mjs (which is also used by
 * the server-side POST /api/admin/run-bank-import fallback when the
 * laptop-to-prod-DB path is blocked).
 *
 * MODES
 *   --import   Backfill canonical bank from JS constants in public/index.html.
 *              Idempotent on set IDs (re-runnable).
 *
 *   --export   (Phase B — not implemented yet.)
 *
 * REQUIRED ENV (loaded from process.env)
 *   DB_HOST, DB_USER, DB_PASSWORD   (DB_NAME defaults to vero_swimgen)
 *
 * USAGE (prefer Node 20.6+ for --env-file support; we ship Node 22)
 *   node --env-file=.env tools/sync_bank.mjs --import --dry-run   # preview counts
 *   node --env-file=.env tools/sync_bank.mjs --import             # apply backfill
 *
 * If your laptop can't reach the DB (e.g. Spaceship IP-allowlist blocks
 * external connections), use the admin route instead:
 *   curl -X POST https://setforge.io/api/admin/run-bank-import \
 *        -H 'Cookie: ...' -H 'X-CSRF-Token: ...'
 * (Easiest from devtools console while logged in as admin — see commit
 * message of the same commit that introduced this script.)
 *
 * NOTE: migrations/030_ugc_bank.sql must be applied before --import.
 */
import path from "path";
import { fileURLToPath } from "url";
import { pool, dbActive } from "../db.js";
import { importBank } from "./bank_importer.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, "..");
const HTML_PATH  = path.join(ROOT, "public", "index.html");

async function runImport({ dryRun }) {
  if (!dbActive) {
    console.error("DB not configured. Set DB_HOST / DB_USER / DB_PASSWORD.");
    process.exit(2);
  }
  await importBank({ pool, htmlPath: HTML_PATH, dryRun });
  console.log("Done.");
  await pool.end();
}

async function runExport() {
  console.error("--export not implemented yet (Phase B).");
  process.exit(3);
}

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
  console.error("Usage: node --env-file=.env tools/sync_bank.mjs --import [--dry-run]");
  console.error("       node --env-file=.env tools/sync_bank.mjs --export   (Phase B, not yet)");
  process.exit(2);
}
