// src/lib/api.js — split from src/lib/shared.js (SPA-split follow-up #1).

export const API_BASE  = "/api";

export const csrf = { token: null };

export function csrfHeaders() {   // exported for src/components/admin/*; engine extractor strips `export`
      return csrf.token ? { "X-CSRF-Token": csrf.token } : {};
    }
