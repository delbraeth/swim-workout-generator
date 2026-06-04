// src/lib/format.js — split from src/lib/shared.js (SPA-split follow-up #1).

import { GENDER_OPTIONS, PHASE_OPTIONS, PSC_LABEL_MAP, SET_ID_NAME_MAP } from "./constants.js";

export function normalizeInitials(raw) {
      return (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    }

export function poolModeLabel(m) {
      return ({ "25y": "SCY (25y)", "25m": "SCM (25m)", "50m": "LCM (50m)", "yds": "SCY (legacy)" })[m] || m;
    }

export function setIdToName(setId) {   // exported for src/components/reports/R3CurationLogTab.jsx (engine extractor strips `export` before vm-eval)
      return SET_ID_NAME_MAP.get(setId) || setId;
    }

export function extractMainLabel(block) {
      if (!block || block.section !== "main") return null;
      if (block.label) return block.label;
      const m = (block.name || "").match(/^Main Set — (.+?)(?:\s+×\d+)?$/);
      return m ? m[1] : null;
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

export function parsePaceMSS(str) {
      if (!str) return null;
      const m = String(str).trim().match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return null;
      const secs = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
      if (secs < 30 || secs > 300) return null;
      return secs;
    }

export function phaseOption(v) {
      return PHASE_OPTIONS.find(p => p.v === (v || "")) || PHASE_OPTIONS[0];
    }

export function formatPscRow(c) {
      const base = PSC_LABEL_MAP[c.constraint_type] || c.constraint_type;
      const valueBit = c.value_num != null ? ` — ${c.value_num} yd` :
                       c.value_str != null ? ` — ${c.value_str}` : "";
      const expiryBit = c.expires_at
        ? ` · expires ${new Date(c.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
        : " · persistent";
      return `${base}${valueBit}${expiryBit}`;
    }

export function genderLabel(v) {
      const o = GENDER_OPTIONS.find(x => x.v === (v || ""));
      return o ? o.label : v;
    }
