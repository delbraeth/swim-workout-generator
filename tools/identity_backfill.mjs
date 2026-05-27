#!/usr/bin/env node
//
// tools/identity_backfill.mjs — Phase 4 / Identity I-B
//
// Per IDENTITY_SCOPE.md §7. Walks users + coach_managed_swimmers, creates
// persons rows for each, populates person_id. Name-splitting via heuristic
// with ambiguous-case flagging.
//
// IDEMPOTENT — rows with person_id != NULL are skipped, so re-running
// is safe. Useful if you fix an ambiguous parse manually and want to
// re-run to pick up newly-added rows.
//
// Usage:
//   node tools/identity_backfill.mjs                 # dry-run by default
//   node tools/identity_backfill.mjs --apply         # actually writes
//
// Dry-run prints what WOULD happen; --apply does the inserts + updates.
// Use dry-run first to eyeball the ambiguous case list before committing.
//
// Ambiguous parses are flagged via audit_events
// (event_type = 'identity.backfill.ambiguous'). After running, review:
//   - Admin → Audit log → filter on event_type
//   - OR: SELECT details FROM audit_events
//         WHERE event_type = 'identity.backfill.ambiguous' ORDER BY created_at DESC
//
// Fix wrong parses by editing the persons row directly:
//   UPDATE persons SET first_name = ?, last_name = ?, initials = ? WHERE id = ?

import { pool, dbAuditEvent } from "../db.js";
import crypto from "node:crypto";

const APPLY = process.argv.includes("--apply");

// Per scope locked decision 10: persons IDs use the existing repo
// convention `px_<base36>`. Matches genGroupId/genEventId/genManagedId
// patterns in db.js.
function genPersonId() {
  const n = crypto.randomBytes(4).readUInt32BE(0);
  return "px_" + n.toString(36).padStart(6, "0").slice(-6);
}

// Heuristic name-split regexes.
//   TITLES match common pre-name honorifics (period optional).
//   SUFFIXES match Jr / Sr / Roman / professional credentials at end.
//   COMPOUND_LAST_PARTICLES detect multi-word surnames ("van der", "de la").
const TITLES = /^(dr|mr|mrs|ms|miss|mx|prof|rev|sir|sgt|capt|cmdr|hon|fr)\.?$/i;
const SUFFIXES = /^(jr|sr|ii|iii|iv|v|phd|md|esq|dds|cpa|do|np|rn)\.?$/i;
const COMPOUND_LAST_PARTICLES = /^(van|von|de|della|del|du|le|la|el|al|bin|ibn|af|st|mc|mac|der|den|dos|das|do|da)$/i;

// Split display_name into { first, last, reasons }.
// reasons is an array of ambiguity flags; empty array = clean parse.
//
// Cases handled:
//   "John Smith"               → first="John",    last="Smith"             []
//   "Smith, John"              → first="John",    last="Smith"             [comma_reversed]
//   "Mary Lou Smith"           → first="Mary Lou", last="Smith"            []  (last-space rule)
//   "Smith"                    → first="Smith",   last="(unknown)"         [single_word]
//   ""                         → first="(unknown)",last="(unknown)"        [empty]
//   "John Smith Jr."           → first="John",    last="Smith Jr."         [suffix_attached]
//   "Dr. John Smith"           → first="Dr. John", last="Smith"            [title_prefix]
//   "Maria van der Berg"       → first="Maria",   last="van der Berg"      [compound_surname]
//   "Smith-Jones"              → first="Smith-Jones", last="(unknown)"     [single_word]
//
// All parses produce SOMETHING — even on ambiguous input we write a
// best-guess. The flags exist so Cap'n can review + correct via SQL.
function parseDisplayName(raw) {
  const norm = (raw || "").trim().replace(/\s+/g, " ");
  if (!norm) {
    return { first: "(unknown)", last: "(unknown)", reasons: ["empty"] };
  }
  if (norm.includes(",")) {
    const [lastPart, firstPart] = norm.split(",", 2).map(s => s.trim());
    if (lastPart && firstPart) {
      return { first: firstPart, last: lastPart, reasons: ["comma_reversed"] };
    }
  }
  const parts = norm.split(" ");
  if (parts.length === 1) {
    return { first: norm, last: "(unknown)", reasons: ["single_word"] };
  }
  const reasons = [];
  let first = parts.slice(0, -1).join(" ");
  let last = parts[parts.length - 1];
  if (TITLES.test(parts[0])) reasons.push("title_prefix");
  if (SUFFIXES.test(last) && parts.length > 2) {
    // Suffix detected — pull it onto the last_name and re-split
    const head = parts.slice(0, -1);
    first = head.slice(0, -1).join(" ");
    last = head[head.length - 1] + " " + parts[parts.length - 1];
    reasons.push("suffix_attached");
  } else if (parts.length >= 3 && COMPOUND_LAST_PARTICLES.test(parts[parts.length - 2])) {
    // Compound surname — walk backwards collecting particle words
    let lastIdx = parts.length - 1;
    while (lastIdx > 1 && COMPOUND_LAST_PARTICLES.test(parts[lastIdx - 1])) {
      lastIdx--;
    }
    first = parts.slice(0, lastIdx).join(" ");
    last = parts.slice(lastIdx).join(" ");
    reasons.push("compound_surname");
  }
  return { first, last, reasons };
}

function genInitials(first, last) {
  const f = (first && first[0] && first[0] !== "(") ? first[0] : "?";
  const l = (last  && last[0]  && last[0]  !== "(") ? last[0]  : "?";
  return (f + l).toUpperCase();
}

async function backfillTable({ table, idCol, ownerCol, ownerEventSubFn }) {
  const sel = `SELECT \`${idCol}\`, \`display_name\`, \`initials\`, \`dob\`, \`gender\`` +
              (ownerCol ? `, \`${ownerCol}\`` : ``) +
              ` FROM \`${table}\` WHERE \`person_id\` IS NULL`;
  const rows = await pool.query(sel);
  console.log(`\n[${table}] ${rows.length} row(s) need backfill`);

  const stats = { scanned: rows.length, linked: 0, flagged: 0, errors: 0 };
  if (rows.length === 0) return stats;

  for (const r of rows) {
    const parse = parseDisplayName(r.display_name);
    const initials = r.initials || genInitials(parse.first, parse.last);
    const personId = genPersonId();
    const idValue = r[idCol];
    const ownerSub = ownerCol ? r[ownerCol] : null;
    const flagLabel = parse.reasons.length ? ` [${parse.reasons.join(",")}]` : "";

    if (!APPLY) {
      console.log(`  DRY-RUN ${personId}  "${r.display_name || "(null)"}" → first="${parse.first}" last="${parse.last}" initials="${initials}"${flagLabel}`);
      stats.linked++;
      if (parse.reasons.length) stats.flagged++;
      continue;
    }

    try {
      await pool.query(
        "INSERT INTO `persons` (`id`, `first_name`, `last_name`, `initials`, `dob`, `gender`) VALUES (?, ?, ?, ?, ?, ?)",
        [personId, parse.first, parse.last, initials, r.dob || null, r.gender || null]
      );
      await pool.query(
        `UPDATE \`${table}\` SET \`person_id\` = ? WHERE \`${idCol}\` = ?`,
        [personId, idValue]
      );
      stats.linked++;
      console.log(`  + ${personId}  ${table}.${idCol}=${String(idValue).slice(-12)}  "${r.display_name || "(null)"}" → "${parse.first} / ${parse.last}"${flagLabel}`);

      if (parse.reasons.length) {
        stats.flagged++;
        dbAuditEvent({
          userSub: ownerEventSubFn ? ownerEventSubFn(r) : ownerSub,
          eventType: "identity.backfill.ambiguous",
          details: {
            source:        table,
            source_id:     idValue,
            display_name:  r.display_name,
            parsed_first:  parse.first,
            parsed_last:   parse.last,
            reasons:       parse.reasons,
            person_id:     personId,
          },
        });
      }
    } catch (e) {
      stats.errors++;
      console.error(`  ERROR ${table}.${idCol}=${idValue}: ${e.message}`);
    }
  }
  return stats;
}

async function main() {
  console.log("=== Identity I-B backfill ===");
  console.log(`Mode: ${APPLY ? "APPLY (writes)" : "DRY-RUN (no writes)"}`);
  console.log("Per IDENTITY_SCOPE.md §7 I-B. Idempotent — re-runnable safely.");

  // users: the source row's owner-for-audit is the user themselves.
  const userStats = await backfillTable({
    table:           "users",
    idCol:           "sub",
    ownerCol:        null,
    ownerEventSubFn: r => r.sub,
  });

  // coach_managed_swimmers: the source row's owner-for-audit is the
  // owning coach. Same pattern as ManagedSwimmer audit events elsewhere.
  const managedStats = await backfillTable({
    table:           "coach_managed_swimmers",
    idCol:           "id",
    ownerCol:        "owner_coach_sub",
    ownerEventSubFn: r => r.owner_coach_sub,
  });

  console.log("\n=== Summary ===");
  for (const [name, s] of [["users", userStats], ["managed", managedStats]]) {
    console.log(`  ${name.padEnd(10)} scanned=${s.scanned}  linked=${s.linked}  flagged=${s.flagged}  errors=${s.errors}`);
  }

  if (!APPLY) {
    console.log("\nDry-run complete. To actually write, re-run with --apply:");
    console.log("  node tools/identity_backfill.mjs --apply");
  } else {
    const total = userStats.flagged + managedStats.flagged;
    if (total) {
      console.log(`\n⚠ ${total} row(s) flagged for review. Audit events: identity.backfill.ambiguous`);
      console.log("  Review in Admin → Audit log, or directly:");
      console.log("    SELECT created_at, details FROM audit_events");
      console.log("    WHERE event_type = 'identity.backfill.ambiguous' ORDER BY created_at DESC;");
      console.log("\n  Fix wrong parses by editing the persons row directly:");
      console.log("    UPDATE persons SET first_name = ?, last_name = ?, initials = ? WHERE id = ?;");
    } else {
      console.log("\n✓ All parses clean. No review needed.");
    }
    console.log("\nI-C (NOT NULL + FK enforcement on person_id columns) is the next phase.");
  }

  // dbAuditEvent is fire-and-forget; give it ~250ms to flush before exit.
  await new Promise(r => setTimeout(r, 250));
  process.exit(0);
}

main().catch(e => {
  console.error("FATAL:", e);
  process.exit(1);
});
