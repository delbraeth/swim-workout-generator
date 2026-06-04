// src/components/shell/TourOverlay.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).

    const { useState, useEffect, useRef } = React;

    export function TourOverlay({ steps, stepIndex, onNext, onBack, onSkip, onFinish }) {
      const step = steps[stepIndex];
      const isLast = stepIndex === steps.length - 1;
      const [rect, setRect] = React.useState(null);
      const cardRef = React.useRef(null);

      React.useLayoutEffect(() => {
        if (!step) return;
        let raf = 0;
        const measure = () => {
          const el = document.querySelector(`[data-tour="${step.sel}"]`);
          if (!el) { setRect(null); return; }
          const r = el.getBoundingClientRect();
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        };
        const el = document.querySelector(`[data-tour="${step.sel}"]`);
        if (el && el.scrollIntoView) el.scrollIntoView({ block: "center", behavior: "smooth" });
        raf = requestAnimationFrame(measure);
        window.addEventListener("resize", measure);
        window.addEventListener("scroll", measure, true);
        return () => {
          cancelAnimationFrame(raf);
          window.removeEventListener("resize", measure);
          window.removeEventListener("scroll", measure, true);
        };
      }, [step]);

      React.useEffect(() => {
        const onKey = (e) => {
          if (e.key === "Escape") { onSkip(); }
          else if (e.key === "ArrowRight" || e.key === "Enter") { isLast ? onFinish() : onNext(); }
          else if (e.key === "ArrowLeft") { if (stepIndex > 0) onBack(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
      }, [stepIndex, isLast, onNext, onBack, onSkip, onFinish]);

      React.useEffect(() => { if (cardRef.current) cardRef.current.focus(); }, [stepIndex]);

      if (!step) return null;

      const pad = 6;
      const vw = window.innerWidth, vh = window.innerHeight;
      const CARD_W = Math.min(320, vw - 24);
      // Card placement: below the anchor if it fits, else above, else centered.
      let cardStyle;
      if (rect) {
        const below = rect.top + rect.height + 150 < vh;
        const top = below ? rect.top + rect.height + pad + 8 : Math.max(12, rect.top - 8 - 150);
        let left = rect.left + rect.width / 2 - CARD_W / 2;
        left = Math.max(12, Math.min(left, vw - CARD_W - 12));
        cardStyle = { position: "fixed", top, left, width: CARD_W };
      } else {
        cardStyle = { position: "fixed", top: "50%", left: "50%", width: CARD_W, transform: "translate(-50%, -50%)" };
      }

      return (
        <div role="dialog" aria-modal="true" aria-label={`Tour: ${step.title}`}>
          {/* Dim + spotlight ring (or full dim when anchor missing) */}
          {rect ? (
            <div style={{
              position: "fixed", top: rect.top - pad, left: rect.left - pad,
              width: rect.width + pad * 2, height: rect.height + pad * 2,
              borderRadius: 10, border: "2px solid var(--color-primary)",
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
              pointerEvents: "none", zIndex: 9000, transition: "all 0.18s ease",
            }} />
          ) : (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", pointerEvents: "none", zIndex: 9000 }} />
          )}

          {/* Tooltip card */}
          <div ref={cardRef} tabIndex={-1} style={{
            ...cardStyle, zIndex: 9001, background: "var(--color-card)",
            border: "1px solid var(--color-border-strong)", borderRadius: 12,
            padding: 16, boxShadow: "0 8px 28px rgba(0,0,0,0.4)", outline: "none",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-dim)", marginBottom: 4 }}>
              Step {stepIndex + 1} of {steps.length}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--color-text)", marginBottom: 6 }}>
              {step.title}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--color-text-dim)", marginBottom: 14 }}>
              {step.body}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <button onClick={onSkip} style={{
                padding: "6px 10px", borderRadius: 8, border: "none", background: "transparent",
                color: "var(--color-text-dim)", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>Skip tour</button>
              <div style={{ display: "flex", gap: 8 }}>
                {stepIndex > 0 && (
                  <button onClick={onBack} style={{
                    padding: "7px 12px", borderRadius: 8, border: "1px solid var(--color-border)",
                    background: "var(--color-bg)", color: "var(--color-text)", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}>Back</button>
                )}
                <button onClick={isLast ? onFinish : onNext} style={{
                  padding: "7px 14px", borderRadius: 8, border: "none",
                  background: "var(--color-primary)", color: "var(--color-bg)", fontSize: 13, fontWeight: 800, cursor: "pointer",
                }}>{isLast ? "Done" : "Next"}</button>
              </div>
            </div>
          </div>
        </div>
      );
    }
