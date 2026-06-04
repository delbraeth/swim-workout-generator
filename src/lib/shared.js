// src/lib/shared.js — shared UI helpers + constants extracted from src/app.jsx
// (SPA-split endgame A). Browser-only (may use fetch/DOM). 64 symbols.
// Engine data/logic is imported from ./engine.js.

import {
  COOLDOWN_OPTIONS, COOLDOWN_OPTIONS_50M, COOLDOWN_OPTIONS_SCM, DRILL_OPTIONS, DRILL_OPTIONS_50M, DRILL_OPTIONS_SCM, EQUIP_REQUIREMENTS, KICK_OPTIONS, KICK_OPTIONS_50M, KICK_OPTIONS_SCM, MAIN_OPTIONS, MAIN_OPTIONS_50M, MAIN_OPTIONS_SCM, WARMUP_OPTIONS, WARMUP_OPTIONS_50M, WARMUP_OPTIONS_SCM, equipMode, getBankOptions, getOverlayRowsForTuple, scaleInterval
} from "./engine.js";
const { useState, useCallback, useMemo, useEffect } = React;

export const API_BASE  = "/api";

const csrf = { token: null };

export function csrfHeaders() {   // exported for src/components/admin/*; engine extractor strips `export`
      return csrf.token ? { "X-CSRF-Token": csrf.token } : {};
    }

export function normalizeInitials(raw) {
      return (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    }

export function poolModeLabel(m) {
      return ({ "25y": "SCY (25y)", "25m": "SCM (25m)", "50m": "LCM (50m)", "yds": "SCY (legacy)" })[m] || m;
    }

export function makeEntryId() {
      return "w" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

export const SECTION_STYLES = {
      warmup:   { bg: "#f0f9ff", border: "#bae6fd", headerBg: "#e0f2fe", headerText: "#075985", dot: "#0ea5e9" },
      drill:    { bg: "#f0fdfa", border: "#99f6e4", headerBg: "#ccfbf1", headerText: "#134e4a", dot: "var(--color-primary)" },
      kick:     { bg: "#fffbeb", border: "#fde68a", headerBg: "#fef3c7", headerText: "#92400e", dot: "#f59e0b" },
      main:     { bg: "#f8fafc", border: "var(--color-text)", headerBg: "var(--color-border)", headerText: "#ffffff", dot: "var(--color-text-dim)" },
      cooldown: { bg: "#f9fafb", border: "#e5e7eb", headerBg: "#f3f4f6", headerText: "#374151", dot: "#9ca3af" },
    };

export const ZONE_ORDER = ["easy", "aerobic", "threshold", "vo2", "anaerobic"];

export const LEVEL_PRESETS = {
      recreational: { id: "recreational", label: "Recreational", emoji: "🏖️", pace: "2:30", description: "Fitness swimmer — long, easy intervals" },
      masters:      { id: "masters",      label: "Masters",      emoji: "🏊", pace: "2:00", description: "Adult masters / triathlete — moderate intervals" },
      competitive:  { id: "competitive",  label: "Competitive",  emoji: "🏁", pace: "1:30", description: "Trained competitive swimmer — tight intervals" },
    };

const SET_ID_NAME_MAP = (() => {
      const m = new Map();
      // Phase H Stage 2: all 12 bank constants are flat arrays now.
      const walkArray = (arr) => {
        if (!Array.isArray(arr)) return;
        for (const opt of arr) {
          if (!opt || !Array.isArray(opt.sets)) continue;
          for (const s of opt.sets) {
            if (s && s.id) m.set(s.id, `${s.reps || 1}×${s.dist} – ${opt.label}`);
          }
        }
      };
      for (const bank of [
        WARMUP_OPTIONS, COOLDOWN_OPTIONS, DRILL_OPTIONS, MAIN_OPTIONS,
        WARMUP_OPTIONS_50M, COOLDOWN_OPTIONS_50M, DRILL_OPTIONS_50M, MAIN_OPTIONS_50M,
        WARMUP_OPTIONS_SCM, COOLDOWN_OPTIONS_SCM, DRILL_OPTIONS_SCM, MAIN_OPTIONS_SCM,
        KICK_OPTIONS, KICK_OPTIONS_50M, KICK_OPTIONS_SCM,
      ]) walkArray(bank);
      return m;
    })();

export function setIdToName(setId) {   // exported for src/components/reports/R3CurationLogTab.jsx (engine extractor strips `export` before vm-eval)
      return SET_ID_NAME_MAP.get(setId) || setId;
    }

let _audioCtx = null;

export function primeAudioCtx() {
      if (!_audioCtx) {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return null;
          _audioCtx = new AC();
        } catch (_) { return null; }
      }
      if (_audioCtx.state === "suspended") {
        _audioCtx.resume().catch(() => {});
      }
      return _audioCtx;
    }

export function playRestCue(kind) {
      const ctx = primeAudioCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const now = ctx.currentTime;
      if (kind === "go") {
        osc.frequency.value = 1320;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.35, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.60);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.60);
      } else {
        // Short beep at T-3/T-2/T-1
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.13);
      }
    }

export function extractMainLabel(block) {
      if (!block || block.section !== "main") return null;
      if (block.label) return block.label;
      const m = (block.name || "").match(/^Main Set — (.+?)(?:\s+×\d+)?$/);
      return m ? m[1] : null;
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

export const EQUIPMENT_LIST = [
      { id: "kickboard", label: "Kickboard", icon: "🟦", description: "Use a board for kick sets" },
      { id: "fins",      label: "Fins",      icon: "🐬", description: "Add fins to kick & underwater sets" },
      { id: "paddles",   label: "Paddles",   icon: "🤚", description: "Add paddles to pull sets" },
      { id: "pullBuoy",  label: "Pull Buoy", icon: "🛟", description: "Confirms buoy use on pull sets" },
      { id: "snorkel",   label: "Snorkel",   icon: "🤿", description: "Adds snorkel cue to freestyle drill and technique sets" },
    ];

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

const RIEGEL_EXP = 1.06;

function riegelRatio(oldDist, newDist) {
      return Math.pow(newDist / oldDist, RIEGEL_EXP);
    }

const STRUCTURED_DESC_RE = /\d+[a-z\s]+\/\s*\d+/i;

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

export const DRYLAND_OPTIONS = [
      { id: "dl_activation", name: "Pre-Pool Activation", placement: "pre", exercises: [
        { name: "Arm circles (fwd/back)", sets: 1, reps: "20 each way", rest: null },
        { name: "Leg swings (front/side)", sets: 1, reps: "10 each leg", rest: null },
        { name: "Band pull-aparts", sets: 2, reps: "15", rest: null },
        { name: "Scapular push-ups", sets: 2, reps: "12", rest: null },
        { name: "Bodyweight squats", sets: 1, reps: "15", rest: null },
      ]},
      { id: "dl_core", name: "Core Circuit", placement: "post", exercises: [
        { name: "Front plank", sets: 3, reps: "45s hold", rest: "20s" },
        { name: "Dead bug", sets: 3, reps: "10 each side", rest: "20s" },
        { name: "Hollow-body hold", sets: 3, reps: "30s hold", rest: "20s" },
        { name: "Russian twists", sets: 3, reps: "20", rest: "20s" },
      ]},
      { id: "dl_shoulder", name: "Shoulder Prehab", placement: "pre", exercises: [
        { name: "Band Y-T-W raises", sets: 2, reps: "10 each", rest: "20s" },
        { name: "Band external rotation", sets: 2, reps: "15 each arm", rest: "20s" },
        { name: "Scapular retraction holds", sets: 2, reps: "20s hold", rest: "20s" },
      ]},
      { id: "dl_strength", name: "Dryland Strength", placement: "post", exercises: [
        { name: "Push-ups", sets: 3, reps: "12", rest: "45s" },
        { name: "Walking lunges", sets: 3, reps: "10 each leg", rest: "45s" },
        { name: "Pull-ups (or rows)", sets: 3, reps: "8", rest: "60s" },
        { name: "Glute bridge", sets: 3, reps: "15", rest: "45s" },
      ]},
      { id: "dl_stretch", name: "Post-Pool Stretch", placement: "post", exercises: [
        { name: "Lat stretch (each side)", sets: 1, reps: "30s hold", rest: null },
        { name: "Pec / doorway stretch", sets: 1, reps: "30s hold", rest: null },
        { name: "Cross-body shoulder", sets: 1, reps: "30s each", rest: null },
        { name: "Hip-flexor lunge stretch", sets: 1, reps: "30s each", rest: null },
      ]},
      { id: "dl_lower", name: "Lower-Body Strength", placement: "post", exercises: [
        { name: "Goblet squat", sets: 3, reps: "10", rest: "60s" },
        { name: "Romanian deadlift (DB)", sets: 3, reps: "10", rest: "60s" },
        { name: "Step-ups (each leg)", sets: 3, reps: "10 each", rest: "45s" },
        { name: "Calf raises", sets: 3, reps: "15", rest: "30s" },
      ]},
      { id: "dl_power", name: "Power / Plyometrics", placement: "pre", exercises: [
        { name: "Box jumps (or squat jumps)", sets: 4, reps: "5", rest: "60s" },
        { name: "Broad jumps", sets: 3, reps: "5", rest: "60s" },
        { name: "Medicine-ball slams", sets: 3, reps: "8", rest: "45s" },
        { name: "Streamline jumps", sets: 3, reps: "6", rest: "45s" },
      ]},
      { id: "dl_mobility", name: "Mobility Flow", placement: "pre", exercises: [
        { name: "World's greatest stretch (each)", sets: 1, reps: "5 each side", rest: null },
        { name: "Cat-cow", sets: 1, reps: "10", rest: null },
        { name: "Thoracic rotations (each)", sets: 1, reps: "8 each", rest: null },
        { name: "Hip 90/90 switches", sets: 1, reps: "8 each", rest: null },
        { name: "Ankle rocks", sets: 1, reps: "10 each", rest: null },
      ]},
      { id: "dl_swimmer_prehab", name: "Swimmer Prehab (shoulders + core)", placement: "pre", exercises: [
        { name: "Band pull-aparts", sets: 2, reps: "15", rest: "20s" },
        { name: "Prone Y-T-W (light)", sets: 2, reps: "8 each", rest: "20s" },
        { name: "Serratus wall slides", sets: 2, reps: "12", rest: "20s" },
        { name: "Side plank (each side)", sets: 2, reps: "30s hold", rest: "20s" },
        { name: "Bird dog", sets: 2, reps: "8 each side", rest: "20s" },
      ]},
      { id: "dl_band", name: "Band Pull (swim-specific)", placement: "post", exercises: [
        { name: "Band freestyle pull (each arm)", sets: 3, reps: "15 each", rest: "30s" },
        { name: "Band straight-arm pulldown", sets: 3, reps: "15", rest: "30s" },
        { name: "Band catch + finish hold", sets: 3, reps: "20s hold", rest: "30s" },
      ]},
      { id: "dl_recovery", name: "Recovery / Foam Roll", placement: "post", exercises: [
        { name: "Foam roll lats (each)", sets: 1, reps: "45s each", rest: null },
        { name: "Foam roll quads / IT band", sets: 1, reps: "45s each", rest: null },
        { name: "Foam roll upper back", sets: 1, reps: "45s", rest: null },
        { name: "Child's pose + side reach", sets: 1, reps: "45s", rest: null },
      ]},
      { id: "dl_core_strong", name: "Core — Advanced", placement: "post", exercises: [
        { name: "Hanging knee raises", sets: 3, reps: "12", rest: "30s" },
        { name: "V-ups", sets: 3, reps: "12", rest: "30s" },
        { name: "Plank shoulder taps", sets: 3, reps: "20", rest: "30s" },
        { name: "Flutter kicks", sets: 3, reps: "30s", rest: "30s" },
        { name: "Superman holds", sets: 3, reps: "20s hold", rest: "30s" },
      ]},
    ];

export const DRYLAND_EXPLAINERS = {
      "Arm circles (fwd/back)": "Big, controlled circles of the arms forward then backward to warm up the shoulder joint and rotator cuff before swimming.",
      "Leg swings (front/side)": "Stand tall and swing one leg front-to-back, then side-to-side; loosens the hips and hamstrings for kicking.",
      "Band pull-aparts": "Hold a resistance band at shoulder height with straight arms and pull it apart, squeezing the shoulder blades together; strengthens the upper back.",
      "Scapular push-ups": "In a straight-arm push-up plank, pinch the shoulder blades together then push them apart — only the blades move. Builds scapular control.",
      "Bodyweight squats": "Feet shoulder-width, sit the hips back and down until the thighs are near parallel, then stand; warms up the legs and hips.",
      "Front plank": "Hold a straight line on forearms and toes, bracing the core — don't let the hips sag or pike. Builds the core stability behind good body position.",
      "Dead bug": "Lie on your back, arms up and knees bent; slowly extend opposite arm and leg while pressing the low back into the floor. Trains anti-extension core control.",
      "Hollow-body hold": "Lie on your back, press the low back down, and lift the shoulders and legs into a shallow banana shape — the streamline core position.",
      "Russian twists": "Sit leaning back with feet up and rotate the torso side to side, tapping the floor each side; works the obliques for stroke rotation.",
      "Band Y-T-W raises": "With a light band, raise the arms into a Y, then T, then W shape, squeezing the shoulder blades each time; rotator-cuff and posture work.",
      "Band external rotation": "Elbow tucked at your side and bent 90°, rotate the forearm outward against a band; strengthens the rotator cuff to protect the shoulder.",
      "Scapular retraction holds": "Pull the shoulder blades down and back and hold; reinforces good posture and a strong catch position.",
      "Push-ups": "Lower the chest to the floor and press back up in a rigid plank; builds the pressing strength used in the pull.",
      "Walking lunges": "Step forward into a lunge, dropping the back knee toward the floor, then step through; builds single-leg strength and balance.",
      "Pull-ups (or rows)": "Hang from a bar and pull the chin over it (or row a band/weight if no bar); the primary back and lat builder, mirroring the swim pull.",
      "Glute bridge": "Lie on your back with knees bent and drive the hips up, squeezing the glutes; strengthens the posterior chain for a stable body line.",
      "Lat stretch (each side)": "Reach one arm overhead and lean away to lengthen the lat down the side of the torso; opens the shoulders for streamline.",
      "Pec / doorway stretch": "Place a forearm on a doorframe and lean through to stretch the chest; counteracts the rounded posture swimming builds.",
      "Cross-body shoulder": "Pull one arm across the chest with the other to stretch the back of the shoulder; relieves shoulder tightness.",
      "Hip-flexor lunge stretch": "In a low lunge, tuck the hips and press forward to stretch the front of the back hip; loosens hip flexors tightened by kicking.",
      "Goblet squat": "Hold a weight at the chest and squat deep, keeping the chest tall; builds leg strength with good posture.",
      "Romanian deadlift (DB)": "Holding dumbbells, hinge at the hips with a flat back, lowering the weights down the legs, then stand; targets hamstrings and glutes.",
      "Step-ups (each leg)": "Step up onto a box with one leg, driving through the heel, then control back down; single-leg power for starts and turns.",
      "Calf raises": "Rise onto the balls of the feet and lower slowly; strengthens the calves and ankles for kicking and push-offs.",
      "Box jumps (or squat jumps)": "Explosively jump onto a box (or straight up); develops the leg power used off the blocks and walls.",
      "Broad jumps": "Jump forward as far as possible from a standing start, landing softly; builds the horizontal explosive power of the start.",
      "Medicine-ball slams": "Lift a medicine ball overhead and slam it down hard, hinging at the hips; full-body power and core drive.",
      "Streamline jumps": "Jump straight up holding a tight streamline with arms locked overhead; links explosive legs to the streamline position off walls.",
      "World's greatest stretch (each)": "From a lunge, drop the elbow inside the front foot, then rotate that same arm to the sky; a full-body mobility opener.",
      "Cat-cow": "On all fours, alternately round and arch the spine; warms up and mobilizes the whole back.",
      "Thoracic rotations (each)": "On all fours or side-lying, rotate the upper back to open the chest; improves the trunk rotation used in freestyle and backstroke.",
      "Hip 90/90 switches": "Sit with both knees bent at 90° to one side, then rotate them to the other side; opens the hips internally and externally.",
      "Ankle rocks": "In a half-kneel, rock the front knee forward over the toes to mobilize the ankle; improves push-off and streamline flexibility.",
      "Prone Y-T-W (light)": "Lie face-down and lift the arms into Y, T, and W shapes off the floor; strengthens the mid-back and rotator cuff.",
      "Serratus wall slides": "Press the forearms on a wall and slide them up while pushing into the wall; activates the serratus for healthy shoulder mechanics.",
      "Side plank (each side)": "Hold a straight line on one forearm and the side of the feet; builds the lateral core stability behind body roll.",
      "Bird dog": "On all fours, extend opposite arm and leg level with the body and hold; trains balanced core stability.",
      "Band freestyle pull (each arm)": "Anchor a band and mimic the freestyle pull stroke against resistance; strengthens the exact catch-and-pull pattern.",
      "Band straight-arm pulldown": "With straight arms, pull a high band down to the thighs; builds the lat engagement that starts the catch.",
      "Band catch + finish hold": "Hold the early-catch position against a band, then the finish position; grooves the strong points of the stroke.",
      "Foam roll lats (each)": "Lie on your side with a foam roller under the lat and roll slowly; releases tightness through the side of the back.",
      "Foam roll quads / IT band": "Roll the front and outside of the thigh on a foam roller to release the quads and IT band after kicking.",
      "Foam roll upper back": "Lie back on a roller under the upper back and roll along the spine; loosens the mid-back for better posture.",
      "Child's pose + side reach": "Kneel and sit back with the arms stretched forward, then walk the hands to each side; a gentle back and lat stretch to finish.",
      "Hanging knee raises": "Hang from a bar and raise the knees toward the chest with control; builds lower-ab strength without straining the back.",
      "V-ups": "Lie flat and simultaneously lift the legs and torso to meet over the hips in a V; strong full-core flexion.",
      "Plank shoulder taps": "In a plank, tap each hand to the opposite shoulder without letting the hips rock; anti-rotation core stability.",
      "Flutter kicks": "Lie on your back, low back pressed down, and make small fast scissoring kicks; mirrors and strengthens the freestyle kick.",
      "Superman holds": "Lie face-down and lift the arms, chest, and legs off the floor and hold; strengthens the lower back and posterior chain.",
    };

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

export function useIsLandscape() {
      const [land, setLand] = useState(() => window.innerWidth > window.innerHeight);
      useEffect(() => {
        const update = () => setLand(window.innerWidth > window.innerHeight);
        window.addEventListener("resize", update);
        window.addEventListener("orientationchange", update);
        return () => {
          window.removeEventListener("resize", update);
          window.removeEventListener("orientationchange", update);
        };
      }, []);
      return land;
    }

export function parseIntervalSeconds(str) {
      if (!str || /no interval/i.test(str)) return null;
      const full = str.match(/(\d+):(\d{2})/);
      if (full) return parseInt(full[1], 10) * 60 + parseInt(full[2], 10);
      const sec  = str.match(/:(\d{2})/);
      if (sec)  return parseInt(sec[1], 10);
      return null;
    }

export function fmtTime(secs) {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}:${String(s).padStart(2, "0")}`;
    }

export const REST_OPTIONS = [
      { label: "Manual", value: null },
      { label: "0s",     value: 0 },
      { label: "30s",    value: 30 },
      { label: "45s",    value: 45 },
      { label: "60s",    value: 60 },
    ];

export const GOAL_METRICS = [
      { id: "workouts_per_week", label: "Workouts / week", unit: "workouts", period: "week",  defaultTarget: 3 },
      { id: "yards_per_week",    label: "Yards / week",    unit: "yds",      period: "week",  defaultTarget: 8000 },
      { id: "yards_per_month",   label: "Yards / month",   unit: "yds",      period: "month", defaultTarget: 32000 },
    ];

export function parsePaceMSS(str) {
      if (!str) return null;
      const m = String(str).trim().match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return null;
      const secs = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      if (secs < 30 || secs > 300) return null;
      return secs;
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

export const CATALOG_SECTIONS = ["warmup", "drill", "kick", "main", "cooldown"];

export const CATALOG_TYPES    = ["all", "im", "distance", "sprint", "endurance", "technique", "mixed", "back", "breast", "fly"];

export const CATALOG_ALL_EQUIP = { kickboard: "preferred", fins: "preferred", paddles: "preferred", pullBuoy: "preferred", snorkel: "preferred" };

export function catalogOptionUsesEquip(opt, equipKey) {
      const tags = EQUIP_REQUIREMENTS[equipKey] || [];
      return (opt.sets || []).some(s => s.eq && tags.includes(s.eq));
    }

export const COMPLETION_LABELS = {
      not_started: { label: "Not started", color: "var(--color-text-dim)" },
      partial:     { label: "Partial",     color: "var(--color-warn)" },
      complete:    { label: "Complete",    color: "var(--color-positive)" },
      missed:      { label: "Missed",      color: "var(--color-destructive)" },
    };

export const REPORT_RANGES = [
      { id: "week",            label: "Last 7 days" },
      { id: "month",           label: "Last 30 days" },
      { id: "quarter",         label: "Last 90 days" },
      { id: "season-to-date",  label: "Season-to-date" },
    ];

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

export const PHASE_OPTIONS = [
      { v: "",         label: "—", color: "var(--color-text-dim)" },
      { v: "base",     label: "Base 🌱",     color: "var(--color-positive)" },
      { v: "build",    label: "Build 🔨",    color: "var(--color-primary)" },
      { v: "peak",     label: "Peak ⛰️",     color: "var(--color-warn)" },
      { v: "taper",    label: "Taper 📉",    color: "var(--color-warn)" },
      { v: "recovery", label: "Recovery 🌿", color: "var(--color-primary)" },
    ];

export function phaseOption(v) {
      return PHASE_OPTIONS.find(p => p.v === (v || "")) || PHASE_OPTIONS[0];
    }

export const DOB_MIN = "1900-01-01";

export const DOB_MAX_TODAY = () => new Date().toISOString().slice(0, 10);

export const PSC_TYPE_GROUPS = [
      {
        label: "Stroke (no fly / breast / back / free)",
        opts: [
          { v: "stroke_no_fly",    label: "No fly" },
          { v: "stroke_no_breast", label: "No breaststroke" },
          { v: "stroke_no_back",   label: "No backstroke" },
          { v: "stroke_no_free",   label: "No freestyle" },
        ],
      },
      {
        label: "Equipment (no paddles / fins / etc.)",
        opts: [
          { v: "equip_no_paddles",   label: "No paddles" },
          { v: "equip_no_fins",      label: "No fins" },
          { v: "equip_no_snorkel",   label: "No snorkel" },
          { v: "equip_no_kickboard", label: "No kickboard" },
          { v: "equip_no_buoy",      label: "No pull-buoy" },
        ],
      },
      {
        label: "Section (skip main / kick / drill)",
        opts: [
          { v: "section_no_main",  label: "Skip main set"  },
          { v: "section_no_kick",  label: "Skip kick section"  },
          { v: "section_no_drill", label: "Skip drill section" },
        ],
      },
      {
        label: "Caps (yardage / intensity)",
        opts: [
          { v: "cap_yardage",   label: "Yardage cap" },
          { v: "cap_intensity", label: "Intensity cap (easy-only)" },
        ],
      },
    ];

export const PSC_LABEL_MAP = (() => {
      const m = {};
      for (const g of PSC_TYPE_GROUPS) for (const o of g.opts) m[o.v] = o.label;
      return m;
    })();

export function formatPscRow(c) {
      const base = PSC_LABEL_MAP[c.constraint_type] || c.constraint_type;
      const valueBit = c.value_num != null ? ` — ${c.value_num} yd` :
                       c.value_str != null ? ` — ${c.value_str}` : "";
      const expiryBit = c.expires_at
        ? ` · expires ${new Date(c.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
        : " · persistent";
      return `${base}${valueBit}${expiryBit}`;
    }

export const GENDER_OPTIONS = [
      { v: "",                  label: "—" },
      { v: "M",                 label: "Male" },
      { v: "F",                 label: "Female" },
      { v: "X",                 label: "Non-binary / other" },
      { v: "prefer_not_to_say", label: "Prefer not to say" },
    ];

export function genderLabel(v) {
      const o = GENDER_OPTIONS.find(x => x.v === (v || ""));
      return o ? o.label : v;
    }

const IMPORT_NEW_HEADERS = ["first_name", "last_name", "preferred_name", "dob", "gender", "initials", "pace_scy_100", "pace_scm_100", "pace_lcm_100", "parental_contact"];

const IMPORT_RECOGNIZED = ["name", "first_name", "last_name", "preferred_name", "dob", "initials", "gender", "pace_scy_100", "pace_scm_100", "pace_lcm_100", "parental_contact"];

const GENDER_CSV_MAP = {
      "m": "M", "male": "M", "boy": "M",
      "f": "F", "female": "F", "girl": "F",
      "x": "X", "nb": "X", "non-binary": "X", "nonbinary": "X", "other": "X",
      "pnts": "prefer_not_to_say", "prefer not to say": "prefer_not_to_say", "decline": "prefer_not_to_say",
    };

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

export const SECTION_EMOJIS = { warmup: "🌊", drill: "🎯", kick: "🦵", main: "💪", cooldown: "🧊" };
