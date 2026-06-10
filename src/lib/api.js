// src/lib/api.js — split from src/lib/shared.js (SPA-split follow-up #1).

export const API_BASE  = "/api";

export const csrf = { token: null };

export function csrfHeaders() {   // exported for src/components/admin/*; engine extractor strips `export`
      return csrf.token ? { "X-CSRF-Token": csrf.token } : {};
    }

// Batched event weather (GET /api/events/weather?ids=…) with ONE retry. In batched
// mode the chips have no self-fetch fallback — per-chip fan-out is the exact 429
// amplifier batching was built to kill — so the single batch call carries the
// resilience instead: one retry after a beat, then give up quietly ({} → chips
// hide). ids are sliced to the server's 40-id cap; callers pass date-sorted lists,
// so the nearest 40 events keep their chips.
export async function fetchEventWeatherBatch(ids) {
      const sliced = (ids || []).slice(0, 40);
      if (!sliced.length) return {};
      const url = `/api/events/weather?ids=${sliced.map(encodeURIComponent).join(",")}`;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const r = await fetch(url, { cache: "no-store" });
          if (r.ok) return await r.json();
        } catch (_) {}
        if (attempt === 0) await new Promise(res => setTimeout(res, 2500));
      }
      return {};
    }
