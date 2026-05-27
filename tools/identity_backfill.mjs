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

// Phase 4 Identity I-B backfill — shares parser + ID generator with the
// live writer paths in db.js (dbEnsureUser + dbCreateManagedSwimmer)
// so backfilled rows + live-created rows have identical name-split
// behavior. If the heuristic drifts in one place, it drifts in both.
import { pool, dbAuditEvent, genPersonId, parseDisplayName, genInitialsFromParts } from "../db.js";

const APPLY = process.argv.includes("--apply");
const genInitials = genInitialsFromParts;  // local alias for the existing code below

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
