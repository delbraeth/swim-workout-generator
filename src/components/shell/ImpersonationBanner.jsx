// src/components/shell/ImpersonationBanner.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).

    const { useState, useEffect, useRef } = React;

    export function ImpersonationBanner({ state, onExit }) {
      const [now, setNow] = React.useState(() => Date.now());
      React.useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 5000);
        return () => clearInterval(id);
      }, []);
      const expiresMs = state.expires_at ? new Date(state.expires_at).getTime() : 0;
      const remainingSec = Math.max(0, Math.floor((expiresMs - now) / 1000));
      const mm = Math.floor(remainingSec / 60);
      const ss = remainingSec % 60;
      // Auto-exit on expiry — fire once when the timer crosses zero.
      const firedRef = React.useRef(false);
      React.useEffect(() => {
        if (remainingSec === 0 && !firedRef.current) {
          firedRef.current = true;
          onExit && onExit();
        }
      }, [remainingSec, onExit]);
      return (
        <div className="screen-only" style={{
          position: "sticky", top: 0, zIndex: 9100,
          background: "#dc2626", color: "#fff",
          padding: "8px 16px", fontSize: 12, fontWeight: 700,
          display: "flex", justifyContent: "center", alignItems: "center", gap: 12, flexWrap: "wrap",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}>
          <span>🛂 Acting as <strong>{state.target_name || state.target_sub.slice(0, 8)}</strong>{state.target_email ? <span style={{ opacity: 0.8, fontWeight: 400 }}> ({state.target_email})</span> : null} — read-only</span>
          <span style={{ fontFamily: "monospace", background: "rgba(0,0,0,0.35)", padding: "2px 8px", borderRadius: 4 }}>
            {mm}:{String(ss).padStart(2, "0")} left
          </span>
          <button
            type="button"
            onClick={onExit}
            style={{
              background: "rgba(0,0,0,0.45)", color: "#fff",
              border: "1px solid rgba(255,255,255,0.6)", borderRadius: 4,
              padding: "3px 12px", fontSize: 11, fontWeight: 700,
              cursor: "pointer",
            }}>
            Exit
          </button>
        </div>
      );
    }
