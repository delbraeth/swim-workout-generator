// src/lib/workout-helpers.js — split from src/lib/shared.js (SPA-split follow-up #1).

import { COOLDOWN_OPTIONS, COOLDOWN_OPTIONS_50M, COOLDOWN_OPTIONS_SCM, DRILL_OPTIONS, DRILL_OPTIONS_50M, DRILL_OPTIONS_SCM, EQUIP_REQUIREMENTS, KICK_OPTIONS, KICK_OPTIONS_50M, KICK_OPTIONS_SCM, MAIN_OPTIONS, MAIN_OPTIONS_50M, MAIN_OPTIONS_SCM, WARMUP_OPTIONS, WARMUP_OPTIONS_50M, WARMUP_OPTIONS_SCM, equipMode, getBankOptions, getOverlayRowsForTuple, scaleInterval } from "./engine.js";
import { GENDER_CSV_MAP, IMPORT_NEW_HEADERS, IMPORT_RECOGNIZED, RIEGEL_EXP, STRUCTURED_DESC_RE } from "./constants.js";
import { parsePaceMSS, setIdToName } from "./format.js";

export function makeEntryId() {
      return "w" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

function isEquipOn(equipment, k)       { return equipMode(equipment, k) !== "off"; }

export function parseIntent(text) {
      const tokens = [];
      // Surrounding spaces simplify \b boundary matches at start/end.
      let remaining = " " + (text || "").toLowerCase().trim() + " ";

      function consume(re, mkToken) {
        let m;
        while ((m = remaining.match(re)) !== null) {
          const tok = mkToken(m);
          if (tok) tokens.push(tok);
          remaining = remaining.slice(0, m.index) + " " + remaining.slice(m.index + m[0].length);
        }
      }

      // 1. Pace: "@2:00", "@ 2:00"
      consume(/@\s*(\d+):(\d{2})\b/, m => {
        const secs = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        if (secs < 30 || secs > 300) return null;  // outside realistic 100-pace range
        return { kind: "pace", value: secs, raw: m[0].trim() };
      });

      // 2. Distance with explicit unit: "2k" → 2000 yd (idiomatic), "1500m" → meters, "2400 yd"
      consume(/\b(\d+)\s*(k|yd|yards|m|meters|y)\b/, m => {
        const n = parseInt(m[1], 10);
        const u = m[2];
        let value, unit;
        if (u === "k")                                       { value = n * 1000; unit = "y"; }
        else if (u === "y" || u === "yd" || u === "yards")   { value = n;        unit = "y"; }
        else if (u === "m" || u === "meters")                { value = n;        unit = "m"; }
        if (value < 500 || value > 10000) return null;       // outside realistic workout range
        return { kind: "distance", value, unit, raw: m[0].trim() };
      });

      // 2b. Bare-number distance fallback. Catches "2400 with fins" where
      //     coach drops the unit. Default unit is yards; handleApplyIntent
      //     converts to current pool unit if needed. Range gate (500-10000)
      //     is loose enough to cover all swim distances; tight enough to
      //     reject incidental small numbers and the @M:SS pace pattern
      //     (which has been consumed in step 1 already).
      consume(/\b(\d{3,5})\b/, m => {
        const n = parseInt(m[1], 10);
        if (n < 500 || n > 10000) return null;
        return { kind: "distance", value: n, unit: "y", raw: m[0] };
      });

      // 3. Duration: "25 min", "1 hr", "2 hours"
      consume(/\b(\d+)\s*(minutes?|min|hours?|hrs?|hr)\b/, m => {
        const n = parseInt(m[1], 10);
        const isHr = /^(hr|hrs|hour|hours)$/.test(m[2]);
        const mins = isHr ? n * 60 : n;
        if (mins < 15 || mins > 240) return null;
        return { kind: "duration", value: mins, raw: m[0].trim() };
      });

      // 4. Workout types — strip BEFORE zones so "sprint" maps to type
      const TYPES = ["im","distance","sprint","endurance","technique","mixed","back","breast","fly"];
      for (const t of TYPES) {
        const re = new RegExp(`\\b${t}\\b`, "i");
        const m  = remaining.match(re);
        if (m) {
          tokens.push({ kind: "type", value: t, raw: t });
          remaining = remaining.slice(0, m.index) + " " + remaining.slice(m.index + m[0].length);
        }
      }

      // 5. Recovery mode
      const recoveryMatch = remaining.match(/\brecovery\b|\beasy day\b/);
      if (recoveryMatch) {
        tokens.push({ kind: "recovery", value: true, raw: recoveryMatch[0] });
        remaining = remaining.slice(0, recoveryMatch.index) + " " + remaining.slice(recoveryMatch.index + recoveryMatch[0].length);
      }

      // 6. T-pace (informational pace reference — no numeric value)
      const tpaceMatch = remaining.match(/@?\s*\bt-?pace\b/i);
      if (tpaceMatch) {
        tokens.push({ kind: "pace_ref", value: "T-pace", raw: tpaceMatch[0].trim() });
        remaining = remaining.slice(0, tpaceMatch.index) + " " + remaining.slice(tpaceMatch.index + tpaceMatch[0].length);
      }

      // 7. Equipment — multi-word phrases first ("pull buoy" before "buoy"
      //    AND before stroke "pull") so equipment matches consume the phrase.
      const EQUIP = [
        ["paddles",   "paddles"],
        ["fins",      "fins"],
        ["snorkel",   "snorkel"],
        ["kickboard", "kickboard"],
        ["pull buoy", "pullBuoy"],
        ["pullbuoy",  "pullBuoy"],
        ["buoy",      "pullBuoy"],
      ];
      for (const [phrase, key] of EQUIP) {
        const re = new RegExp(`\\b${phrase}\\b`, "i");
        const m  = remaining.match(re);
        if (m) {
          tokens.push({ kind: "equipment", value: key, raw: phrase });
          remaining = remaining.slice(0, m.index) + " " + remaining.slice(m.index + m[0].length);
        }
      }

      // 8. Stroke actions (kick/pull/drill/swim/scull and gerund/plural forms).
      //    Informational only — no form-state mapping today. Future: could
      //    bias the picker toward sets containing the matched stroke.
      //    Runs AFTER equipment so "pull buoy" is consumed first; "pull"
      //    on its own (or "pulling") still matches here.
      consume(/\b(kick|pull|drill|swim|scull)(ing|s)?\b/i, m => {
        return { kind: "stroke", value: m[1].toLowerCase(), raw: m[0] };
      });

      // 9. Zones — primary names + common effort synonyms coaches use.
      //    Effort synonyms map to the closest zone so the chip preview shows
      //    the canonical zone name. Run AFTER type so standalone "sprint"
      //    has already been consumed as a type.
      const ZONE_SYNONYMS = [
        ["easy",      "easy"],
        ["aerobic",   "aerobic"],
        ["threshold", "threshold"],
        ["vo2",       "vo2"],
        ["anaerobic", "anaerobic"],
        ["strong",    "threshold"],
        ["hard",      "anaerobic"],
        ["all-out",   "anaerobic"],
        ["all out",   "anaerobic"],
        ["fast",      "vo2"],
        ["smooth",    "aerobic"],
        ["steady",    "aerobic"],
        ["light",     "easy"],
        ["moderate",  "aerobic"],
      ];
      for (const [phrase, zone] of ZONE_SYNONYMS) {
        const re = new RegExp(`\\b${phrase}\\b`, "i");
        const m  = remaining.match(re);
        if (m) {
          tokens.push({ kind: "zone", value: zone, raw: phrase });
          remaining = remaining.slice(0, m.index) + " " + remaining.slice(m.index + m[0].length);
        }
      }

      // Strip trivial connectors / punctuation from unparsed remainder.
      // Expanded list captures coach filler ("today", "session", "workout",
      // "set", "doing", "yards" stray, etc.) so the unparsed display is clean.
      const unparsed = remaining
        .replace(/\b(with|and|a|an|the|some|just|please|also|plus|of|on|at|for|to|today|session|workout|set|doing|yards|yard|meters|meter|only)\b/gi, " ")
        .replace(/[,.!?]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      // Dedupe (kind, value) tuples — happens when synonyms collide with
      // canonical names (e.g. "strong threshold" → strong→threshold + threshold).
      // Preserves first-seen ordering. Tokens with structured `value` (objects)
      // get their JSON used as the dedup key — currently no token kind has
      // object values so this is a future-safety guard.
      const seen = new Set();
      const dedupedTokens = [];
      for (const t of tokens) {
        const key = `${t.kind}:${typeof t.value === "object" ? JSON.stringify(t.value) : t.value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        dedupedTokens.push(t);
      }

      return { tokens: dedupedTokens, unparsed };
    }

export function equipmentForSet(set, equip) {
      if (!set.eq) return [];
      const items = [];
      // F: treat "preferred" and "required" both as "use this gear in description".
      // Only "off" suppresses the badge/desc rewrite.
      if (set.eq === "kick" || set.eq === "kickPart") {
        if (isEquipOn(equip, "kickboard")) items.push("kickboard");
        if (isEquipOn(equip, "fins"))      items.push("fins");
      } else if (set.eq === "underkick") {
        // Underwater kick is from streamline — kickboard doesn't apply, fins do
        if (isEquipOn(equip, "fins"))      items.push("fins");
      } else if (set.eq === "pull") {
        if (isEquipOn(equip, "paddles"))   items.push("paddles");
        if (isEquipOn(equip, "pullBuoy"))  items.push("buoy");
      } else if (set.eq === "snorkel") {
        if (isEquipOn(equip, "snorkel"))   items.push("snorkel");
      }
      return items;
    }

export function enhanceDesc(set, equip) {
      const items = equipmentForSet(set, equip);
      if (items.length === 0) return set.desc;
      const eqText = items.join(" + ");
      if (set.eq === "kick") {
        return set.desc
          .replace(/\s*\(board optional\)/i, "")
          .replace(/^IM order kick\b/, `IM order kick with ${eqText}`)
          .replace(/^Kick\b/, `Kick with ${eqText}`);
      }
      if (set.eq === "underkick") {
        return set.desc.replace(/^Underwater kick\b/, `Underwater kick with ${eqText}`);
      }
      if (set.eq === "kickPart") {
        // Multi-part set ("Kick 25 / Drill 25 / Swim 25") — annotate kick portions
        return `${set.desc}  ·  kick portions with ${eqText}`;
      }
      if (set.eq === "pull") {
        return set.desc.replace(/Pull\s*\(buoy\)/i, `Pull with ${eqText}`);
      }
      if (set.eq === "snorkel") {
        return set.desc + "  ·  use snorkel";
      }
      return set.desc;
    }

export function computeSubstitutionsForSwimmer(workout, constraints) {
      const out = [];
      if (!workout || !Array.isArray(workout.blocks) || !Array.isArray(constraints) || constraints.length === 0) {
        return out;
      }
      const STROKE_REGEX = {
        fly:    /\b(fly|butterfly)\b/i,
        breast: /\bbreast(?:stroke)?\b/i,
        back:   /\bback(?:stroke)?\b/i,
        free:   /\b(free(?:style)?|FREE)\b/i,
      };
      const STROKE_FROM_TYPE = {
        stroke_no_fly:    "fly",
        stroke_no_breast: "breast",
        stroke_no_back:   "back",
        stroke_no_free:   "free",
      };
      // v1 substitution table (stroke). stroke_no_free defaults to back per scope §6 open fork.
      const STROKE_SUB = {
        stroke_no_fly:    "free",
        stroke_no_breast: "free",
        stroke_no_back:   "free",
        stroke_no_free:   "back",
      };
      const EQ_TO_BANNED = {
        paddles:   "equip_no_paddles",
        fins:      "equip_no_fins",
        snorkel:   "equip_no_snorkel",
        kick:      "equip_no_kickboard",
        pull:      "equip_no_buoy",
      };
      const SECTION_BANNED = {
        warmup:   null,                // no section_no_warmup in v1 vocab
        drill:    "section_no_drill",
        main:     "section_no_main",
        cooldown: null,                // no section_no_cooldown in v1 vocab
      };

      // Workout-level caps surface once each.
      for (const c of constraints) {
        if (c.constraint_type === "cap_yardage") {
          out.push({ kind: "cap_yardage", value: c.value_num, constraint_type: "cap_yardage" });
        } else if (c.constraint_type === "cap_intensity") {
          out.push({ kind: "cap_intensity", value: c.value_str || "easy_only", constraint_type: "cap_intensity" });
        }
      }

      for (let bi = 0; bi < workout.blocks.length; bi++) {
        const block = workout.blocks[bi];
        if (!block) continue;

        // Section-level skip — check any constraint marks this section banned.
        const sectionBan = SECTION_BANNED[block.section];
        if (sectionBan) {
          const hit = constraints.find(c => c.constraint_type === sectionBan);
          if (hit) {
            out.push({ block_idx: bi, kind: "section_skip", section: block.section, constraint_type: sectionBan });
            continue;  // No need to also annotate per-set when the whole section is skipped.
          }
        }

        const sets = Array.isArray(block.sets) ? block.sets : [];
        for (let si = 0; si < sets.length; si++) {
          const s = sets[si];
          const blob = ((s.desc || "") + " " + (s.focus || ""));
          // Stroke subs — first matching constraint wins for this set.
          let strokeSubbed = false;
          for (const c of constraints) {
            const target = STROKE_FROM_TYPE[c.constraint_type];
            if (!target) continue;
            const re = STROKE_REGEX[target];
            if (re && re.test(blob)) {
              out.push({
                block_idx: bi, set_idx: si,
                kind: "stroke_sub",
                from: target,
                to:   STROKE_SUB[c.constraint_type],
                constraint_type: c.constraint_type,
              });
              strokeSubbed = true;
              break;
            }
          }
          // Equip drops — independent of stroke (a set can both swap stroke AND drop gear).
          if (s.eq) {
            const banKey = EQ_TO_BANNED[s.eq];
            if (banKey) {
              const hit = constraints.find(c => c.constraint_type === banKey);
              if (hit) {
                out.push({
                  block_idx: bi, set_idx: si,
                  kind: "equip_drop",
                  eq: s.eq,
                  constraint_type: banKey,
                });
              }
            }
          }
        }
      }
      return out;
    }

export function getCatalogList(kind, typeId, poolMode, ugcOverlay = null) {
      const BANKS = {
        warmup:   { "25y": WARMUP_OPTIONS,   "25m": WARMUP_OPTIONS_SCM,   "50m": WARMUP_OPTIONS_50M   },
        cooldown: { "25y": COOLDOWN_OPTIONS, "25m": COOLDOWN_OPTIONS_SCM, "50m": COOLDOWN_OPTIONS_50M },
        drill:    { "25y": DRILL_OPTIONS,    "25m": DRILL_OPTIONS_SCM,    "50m": DRILL_OPTIONS_50M    },
        kick:     { "25y": KICK_OPTIONS,     "25m": KICK_OPTIONS_SCM,     "50m": KICK_OPTIONS_50M     },
        main:     { "25y": MAIN_OPTIONS,     "25m": MAIN_OPTIONS_SCM,     "50m": MAIN_OPTIONS_50M     },
      };
      const bank = BANKS[kind] && BANKS[kind][poolMode];
      // kick is a non-typed (flat) bank like warmup/cooldown — its options
      // carry empty types[]/strokes[], so it shows everything regardless of typeId.
      const isFlat = (kind === "warmup" || kind === "cooldown" || kind === "kick");
      // Phase H Stage 2: banks are flat arrays with types[]/strokes[] tags.
      // - flat sections (warmup/cooldown): show everything, _typeId=null
      // - typed sections, typeId="all": show everything, _typeId=first tag
      //   (preserves catalog grouping by primary type)
      // - typed sections, specific typeId: filter by types/strokes inclusion
      let canonical;
      if (!bank) {
        canonical = [];
      } else if (isFlat) {
        canonical = bank.map((o, i) => ({ ...o, _typeId: null, _idx: i }));
      } else if (typeId === "all") {
        canonical = bank.map((o, i) => ({
          ...o,
          _typeId: (o.types && o.types[0]) || (o.strokes && o.strokes[0]) || null,
          _idx: i,
        }));
      } else {
        canonical = bank
          .filter(o =>
            (o.types   && o.types.includes(typeId)) ||
            (o.strokes && o.strokes.includes(typeId))
          )
          .map((o, i) => ({ ...o, _typeId: typeId, _idx: i }));
      }
      // UGC overlay (Phase B+) — append exact-pool-mode rows that match
      // the tuple. Already carry _ugc/_author_sub/_visibility metadata
      // from the server. We add _typeId/_idx to match the catalog shape.
      const overlayRows = getOverlayRowsForTuple(ugcOverlay, kind, typeId, poolMode);
      if (!overlayRows.length) return canonical;
      const overlayShaped = overlayRows.map((o, i) => ({
        ...o,
        _typeId: isFlat ? null : (o._typeId || typeId),
        _idx:    canonical.length + i,
      }));
      return canonical.concat(overlayShaped);
    }

const _distSetCache = new Map();

function _distSetForMode(poolMode) {
      const cached = _distSetCache.get(poolMode);
      if (cached) return cached;
      const isMeters25 = poolMode === "25m";
      const isMeters50 = poolMode === "50m";
      const flat   = isMeters25 ? [WARMUP_OPTIONS_SCM, COOLDOWN_OPTIONS_SCM]
                   : isMeters50 ? [WARMUP_OPTIONS_50M, COOLDOWN_OPTIONS_50M]
                   :              [WARMUP_OPTIONS,     COOLDOWN_OPTIONS];
      const typed  = isMeters25 ? [DRILL_OPTIONS_SCM, MAIN_OPTIONS_SCM]
                   : isMeters50 ? [DRILL_OPTIONS_50M, MAIN_OPTIONS_50M]
                   :              [DRILL_OPTIONS,     MAIN_OPTIONS];
      // Phase H Stage 2: all four banks (flat + typed) are flat arrays now.
      const dists = new Set();
      for (const bank of [...flat, ...typed]) {
        for (const opt of bank) for (const s of opt.sets) dists.add(s.dist);
      }
      _distSetCache.set(poolMode, dists);
      return dists;
    }

function riegelRatio(oldDist, newDist) {
      return Math.pow(newDist / oldDist, RIEGEL_EXP);
    }

export function getEquivalents(set, poolMode = "25y") {
      const result = { shorter: null, longer: null };
      // Suppress swaps entirely for sets whose desc describes a within-set
      // numeric breakdown — the rescale would leave the displayed text wrong.
      if (set.desc && STRUCTURED_DESC_RE.test(set.desc)) return result;
      const dists = _distSetForMode(poolMode);
      if (set.dist >= 50) {
        const newDist = set.dist / 2;
        if (dists.has(newDist)) {
          result.shorter = {
            ...set,
            dist:     newDist,
            reps:     set.reps * 2,
            interval: scaleInterval(set.interval, riegelRatio(set.dist, newDist)),
          };
        }
      }
      if (set.reps >= 2 && set.reps % 2 === 0) {
        const newDist = set.dist * 2;
        if (dists.has(newDist)) {
          result.longer = {
            ...set,
            dist:     newDist,
            reps:     set.reps / 2,
            interval: scaleInterval(set.interval, riegelRatio(set.dist, newDist)),
          };
        }
      }
      return result;
    }

export function makeDrylandBlock(option, placement) {
      return {
        kind: "dryland",
        section: "dryland",
        name: option.name,
        placement: placement || option.placement || "pre",
        exercises: (option.exercises || []).map(e => ({ ...e })),
        totalYards: 0,
      };
    }

export function minYardsForType(typeId, poolMode = "25y") {
      const allWarmups   = getBankOptions("warmup",   typeId, poolMode);
      const allCooldowns = getBankOptions("cooldown", typeId, poolMode);
      const drillList    = getBankOptions("drill",    typeId, poolMode);
      const mainList     = getBankOptions("main",     typeId, poolMode);
      const minWarmup   = Math.min(...allWarmups.map(o => o.totalYards));
      const minDrill    = Math.min(...drillList.map(o => o.totalYards));
      const minMain     = Math.min(...mainList.map(o => o.totalYards));
      const minCooldown = Math.min(...allCooldowns.map(o => o.totalYards));
      return minWarmup + minDrill + minMain + minCooldown;
    }

export function rescaleBlocksForPace(blocks, paceStr) {
      const secs = parsePaceMSS(paceStr);
      if (!secs) return blocks;
      const ratio = secs / 120; // PACE_BASELINE_SECS
      return blocks.map(b => Array.isArray(b.sets) ? ({
        ...b,
        sets: b.sets.map(s => ({ ...s, interval: scaleInterval(s.interval, ratio) })),
      }) : b);   // Section model B — dryland blocks have no intervals; pass through.
    }

export function catalogOptionUsesEquip(opt, equipKey) {
      const tags = EQUIP_REQUIREMENTS[equipKey] || [];
      return (opt.sets || []).some(s => s.eq && tags.includes(s.eq));
    }

export function reportToMarkdown(tab, data) {
      const lines = [];
      const fmt = (n) => Number(n || 0).toLocaleString();
      const pct = (n) => Math.round(Number(n || 0));
      const titleFor = {
        "programming-mix":    "Programming Mix",
        "schedule-adherence": "Schedule Adherence",
        "curation-log":       "Curation Log",
        "program-recap":      "Program Recap",
        "platform-health":    "Platform Health",
        "curation-support":   "Curation & Support",
      }[tab] || "Report";
      lines.push(`# SetForge · ${titleFor}`);
      lines.push(`*Range: ${data.startYmd} → ${data.endYmd} · generated ${new Date().toISOString().slice(0, 10)}*`);
      lines.push("");
      const table = (rows, headers) => {
        if (!rows.length) return ["_(no data)_", ""];
        const out = [`| ${headers.join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`];
        rows.forEach(r => out.push(`| ${r.join(" | ")} |`));
        out.push("");
        return out;
      };
      if (tab === "programming-mix") {
        lines.push("## Summary", "", `- **Total yards:** ${fmt(data.totalYards)}`, `- **Workouts:** ${data.workoutCount}`, `- **Distinct bank labels:** ${(data.bankLabels || []).length}`, "");
        const srcTotal = Object.values(data.sourceCounts || {}).reduce((s, n) => s + n, 0);
        lines.push(`- **Source mix:** Bank ${pct((data.sourceCounts?.bank || 0) / Math.max(1, srcTotal) * 100)}% · Engine ${pct((data.sourceCounts?.engine || 0) / Math.max(1, srcTotal) * 100)}% · Mix ${pct((data.sourceCounts?.mix || 0) / Math.max(1, srcTotal) * 100)}%`, "");
        lines.push("## Yards by type", "");
        lines.push(...table(Object.entries(data.yardsByType || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, fmt(v)]), ["Type", "Yards"]));
        lines.push("## Yards by stroke", "");
        lines.push(...table(Object.entries(data.yardsByStroke || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, fmt(v)]), ["Stroke", "Yards"]));
        lines.push("## Yards by section", "");
        lines.push(...table(Object.entries(data.sectionYards || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, fmt(v)]), ["Section", "Yards"]));
      } else if (tab === "schedule-adherence") {
        lines.push("## Schedule completion", "", `- **Scheduled:** ${data.scheduledCount}`, `- **Completed:** ${data.completedCount} (${pct(data.completionPct)}%)`, `- **With attendance:** ${data.withAttendance}`, `- **Without attendance:** ${data.withoutAttendance}`, `- **Avg attendance per practice:** ${pct(data.avgAttendancePct)}%`, "");
        if (data.rosterTrend) lines.push("## Roster trend", "", `- **Joined:** +${data.rosterTrend.added}`, `- **Left:** −${data.rosterTrend.removed}`, "");
      } else if (tab === "curation-log") {
        const section = (title, favs, dis, fmtItem) => {
          lines.push(`## ${title}`, "", `### ★ Favorites (${favs.length})`, "");
          if (!favs.length) lines.push("_(none in range)_", "");
          else favs.forEach(f => lines.push(`- ${fmtItem(f)}`));
          lines.push("", `### 👎 Disfavorites (${dis.length})`, "");
          if (!dis.length) lines.push("_(none in range)_", "");
          else dis.forEach(d => lines.push(`- ${fmtItem(d)}`));
          lines.push("");
        };
        section("Bank labels", data.bankLabels?.favorites || [], data.bankLabels?.disfavorites || [], x => x.label);
        section("Sets", data.sets?.favorites || [], data.sets?.disfavorites || [], x => setIdToName(x.set_id));
        section("Engine tuples (current state)", data.engine?.favorites || [], data.engine?.disfavorites || [], x => `\`${x.template_id}\` · ${x.stroke}`);
      } else if (tab === "program-recap") {
        lines.push("## Summary", "", `- **Total yards:** ${fmt(data.totalYards)}`, `- **Workouts:** ${data.workoutCount}`);
        if (data.multiLane?.generated > 0) lines.push(`- **Multi-lane fit rate:** ${pct(data.multiLane.successPct)}% (${data.multiLane.withoutFallback}/${data.multiLane.generated})`);
        lines.push("");
        lines.push("## Yards by type", "");
        lines.push(...table(Object.entries(data.yardsByType || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, fmt(v)]), ["Type", "Yards"]));
        lines.push("## Yards by stroke", "");
        lines.push(...table(Object.entries(data.yardsByStroke || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, fmt(v)]), ["Stroke", "Yards"]));
        if ((data.strokeGaps || []).length > 0) {
          lines.push("## Stroke gaps (30-day windows)", "");
          lines.push(...table(data.strokeGaps.map(g => [`${g.windowStart} → ${g.windowEnd}`, g.missingStrokes.join(", ")]), ["Window", "Missing"]));
        }
      } else if (tab === "platform-health") {
        const ac = data.activeCoaches || {}; const fa = data.featureAdoption || {};
        lines.push("## Active coaches", "", `- **7 day:** ${ac.d7}`, `- **14 day:** ${ac.d14}`, `- **30 day:** ${ac.d30}`, "");
        lines.push("## Feature adoption", "", `- **Engine:** ${pct(fa.enginePct)}%`, `- **Mix:** ${pct(fa.mixPct)}%`, `- **Multi-lane:** ${pct(fa.multiLanePct)}%`, `- **Fallback rate:** ${pct(fa.fallbackPct)}%`, `- **Users with favs/disfavs:** ${fa.usersWithFavs}/${fa.usersWithDis} of ${fa.totalUsers}`, "");
        if ((data.weeklyByTeam || []).length) {
          lines.push("## Workouts per week", "");
          lines.push(...table(data.weeklyByTeam.map(w => [`Week of ${w.weekStart}`, fmt(w.total)]), ["Week", "Workouts"]));
        }
      } else if (tab === "curation-support") {
        if ((data.curationByTeam || []).length) {
          lines.push("## Propagating disfavor by team", "");
          lines.push(...table(data.curationByTeam.map(t => [t.team_name, t.coach_count, t.label_count, t.set_count, t.engine_count, t.total_propagating]), ["Team", "Coaches", "Labels", "Sets", "Engine", "Total"]));
        }
        if ((data.impersonationByActor || []).length) {
          lines.push("## Impersonation activity", "");
          lines.push(...table(data.impersonationByActor.map(a => [a.admin_sub.slice(0, 20), a.sessions, a.avg_minutes, a.distinct_targets]), ["Admin sub", "Sessions", "Avg min", "Distinct targets"]));
        }
      }
      return lines.join("\n");
    }

function csvAutoSplit(text) {
      // Strip BOM, normalize newlines.
      text = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      if (!text.trim()) return { rows: [], delim: "," };
      // Auto-detect delimiter from the first line: tab if there's at least one,
      // else comma. (Most coach exports are one or the other.)
      const firstLine = text.split("\n", 1)[0];
      const delim = firstLine.includes("\t") ? "\t" : ",";
      // Tokenize line by line. State machine handles quoted fields.
      const rows = [];
      for (const rawLine of text.split("\n")) {
        if (!rawLine.trim()) continue;
        const cells = [];
        let cur = "";
        let inQuotes = false;
        for (let i = 0; i < rawLine.length; i++) {
          const ch = rawLine[i];
          if (inQuotes) {
            if (ch === '"') {
              if (rawLine[i + 1] === '"') { cur += '"'; i++; }                // "" → "
              else inQuotes = false;
            } else cur += ch;
          } else {
            if (ch === '"') inQuotes = true;
            else if (ch === delim) { cells.push(cur); cur = ""; }
            else cur += ch;
          }
        }
        cells.push(cur);
        rows.push(cells.map(c => c.trim()));
      }
      return { rows, delim };
    }

export function csvParseSwimmers(text) {
      const { rows } = csvAutoSplit(text);
      if (!rows.length) return { ok: false, error: "No data found." };
      const headerCells = rows[0].map(h => h.toLowerCase().trim());
      // Validate required headers exist.
      if (!headerCells.includes("dob")) return { ok: false, error: `Missing required column: dob. Expected headers: ${IMPORT_NEW_HEADERS.join(", ")} (legacy single 'name' column also accepted).` };
      if (!headerCells.includes("first_name") && !headerCells.includes("name")) return { ok: false, error: "Missing a name column: provide first_name (+ optional last_name), or the legacy single 'name' column." };
      // Build column-index map for known headers (ignore unknown columns).
      const idx = {};
      for (const h of IMPORT_RECOGNIZED) {
        const i = headerCells.indexOf(h);
        if (i >= 0) idx[h] = i;
      }
      // Convert each data row into a raw object.
      const dataRows = [];
      for (let r = 1; r < rows.length; r++) {
        const obj = {};
        for (const [h, i] of Object.entries(idx)) obj[h] = rows[r][i] || "";
        // Skip empty rows (all known fields blank).
        if (Object.values(obj).every(v => !v.trim())) continue;
        dataRows.push(obj);
      }
      return { ok: true, dataRows };
    }

export function normalizeImportRow(raw) {
      // I-H name resolution: explicit first_name (+ last_name) preferred; else
      // split the legacy single `name` column and flag a warning so the coach
      // can verify. preferred_name is optional in both paths.
      const first     = (raw.first_name || "").trim();
      const last      = (raw.last_name  || "").trim();
      const preferred = (raw.preferred_name || "").trim() || null;
      const legacy    = (raw.name || "").trim();
      let nameFields, warning = null;
      if (first) {
        if (first.length > 80) return { ok: false, error: "first_name too long (>80 chars)" };
        if (last.length  > 80) return { ok: false, error: "last_name too long (>80 chars)" };
        if (preferred && preferred.length > 80) return { ok: false, error: "preferred_name too long (>80 chars)" };
        nameFields = { first_name: first, last_name: last, preferred_name: preferred };
      } else if (legacy) {
        if (legacy.length > 120) return { ok: false, error: "name too long (>120 chars)" };
        nameFields = { display_name: legacy, preferred_name: preferred };
        warning = "split from single 'name' column — verify first/last";
      } else {
        return { ok: false, error: "first_name (or legacy 'name') is empty" };
      }
      const dobRaw = (raw.dob || "").trim();
      if (!dobRaw) return { ok: false, error: "dob is empty" };
      // Accept YYYY-MM-DD or MM/DD/YYYY (or M/D/YYYY).
      let dob = null;
      const isoMatch = dobRaw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      const usMatch  = dobRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (isoMatch) {
        dob = `${isoMatch[1]}-${String(isoMatch[2]).padStart(2, "0")}-${String(isoMatch[3]).padStart(2, "0")}`;
      } else if (usMatch) {
        dob = `${usMatch[3]}-${String(usMatch[1]).padStart(2, "0")}-${String(usMatch[2]).padStart(2, "0")}`;
      } else {
        return { ok: false, error: `dob format not recognized (use YYYY-MM-DD or MM/DD/YYYY): ${dobRaw}` };
      }
      // Sanity-check the date is real.
      const d = new Date(dob + "T00:00:00Z");
      if (Number.isNaN(d.getTime())) return { ok: false, error: `dob is not a real date: ${dobRaw}` };
      if (d > new Date()) return { ok: false, error: `dob is in the future: ${dobRaw}` };
      if (d.getUTCFullYear() < 1900) return { ok: false, error: `dob before 1900: ${dobRaw}` };

      const initials = (raw.initials || "").trim() || null;
      if (initials && initials.length > 4) return { ok: false, error: "initials too long (>4 chars)" };
      // Gender: tolerant CSV mapping (e.g. "Female" → "F"). Empty cell → null.
      let gender = null;
      const gRaw = (raw.gender || "").trim();
      if (gRaw) {
        const mapped = GENDER_CSV_MAP[gRaw.toLowerCase()];
        if (!mapped) return { ok: false, error: `gender not recognized (M/F/X/PNTS or full words): ${gRaw}` };
        gender = mapped;
      }
      const pace_scy_100 = (raw.pace_scy_100 || "").trim() || null;
      const pace_scm_100 = (raw.pace_scm_100 || "").trim() || null;
      const pace_lcm_100 = (raw.pace_lcm_100 || "").trim() || null;
      for (const [k, v] of [["pace_scy_100", pace_scy_100], ["pace_scm_100", pace_scm_100], ["pace_lcm_100", pace_lcm_100]]) {
        if (v && v.length > 8) return { ok: false, error: `${k} too long (>8 chars)` };
      }
      const parental_contact = (raw.parental_contact || "").trim() || null;
      if (parental_contact && parental_contact.length > 255) return { ok: false, error: "parental_contact too long (>255 chars)" };

      return { ok: true, warning, normalized: {
        ...nameFields, initials, dob, gender,
        pace_scy_100, pace_scm_100, pace_lcm_100,
        parental_contact,
      } };
    }

function buildTemplateCSV() {
      const header = IMPORT_NEW_HEADERS.join(",");
      // Column order matches IMPORT_NEW_HEADERS:
      // first_name,last_name,preferred_name,dob,gender,initials,pace_scy_100,pace_scm_100,pace_lcm_100,parental_contact
      const example = "Sarah,Johnson,,2010-03-15,F,SJ,2:05,,,parent@example.com";
      return header + "\n" + example + "\n";
    }

export function downloadTemplate() {
      const blob = new Blob([buildTemplateCSV()], { type: "text/csv" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = "setforge-swimmer-import-template.csv";
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
    }
