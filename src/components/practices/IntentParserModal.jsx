// src/components/practices/IntentParserModal.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { parseIntent } from "../../lib/workout-helpers.js";

    const { useState, useEffect, useRef } = React;

    export function IntentParserModal({ onClose, onApply }) {
      const [text, setText]   = React.useState("");
      const [parsed, setParsed] = React.useState(null); // { tokens, unparsed } | null

      const inputRef = React.useRef(null);
      React.useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

      const handleParse = () => {
        const result = parseIntent(text);
        setParsed(result);
      };

      const handleApply = () => {
        if (!parsed || !parsed.tokens.length) return;
        onApply(parsed);
        onClose();
      };

      const examples = [
        "easy 2k aerobic",
        "threshold 25 min @ 2:00",
        "im 2400 yards with paddles",
        "sprint 1500 m",
        "back 60 min",
        "recovery, just kicking",
      ];

      // Pretty-print a single token for the chip preview.
      const labelFor = (tok) => {
        switch (tok.kind) {
          case "type":      return `Type · ${tok.value}`;
          case "distance":  return `Distance · ${tok.value} ${tok.unit === "y" ? "yd" : "m"}`;
          case "duration":  return `Duration · ${tok.value} min`;
          case "pace":      return `Pace · ${Math.floor(tok.value/60)}:${String(tok.value%60).padStart(2,"0")}/100`;
          case "pace_ref":  return `Pace · ${tok.value}`;
          case "zone":      return `Zone · ${tok.value}`;
          case "stroke":    return `Stroke · ${tok.value}`;
          case "recovery":  return `Recovery mode`;
          case "equipment": return `Equipment · ${tok.value}`;
          default:          return `${tok.kind} · ${tok.value}`;
        }
      };

      const colorFor = (tok) => {
        switch (tok.kind) {
          case "type":      return { bg: "#1e3a8a", border: "var(--color-primary)", color: "#dbeafe" };
          case "distance":  return { bg: "#0c4a6e", border: "#0ea5e9", color: "#bae6fd" };
          case "duration":  return { bg: "#0c4a6e", border: "#0ea5e9", color: "#bae6fd" };
          case "pace":      return { bg: "#581c87", border: "#a855f7", color: "#e9d5ff" };
          case "pace_ref":  return { bg: "#581c87", border: "#a855f7", color: "#e9d5ff" };
          case "zone":      return { bg: "#365314", border: "#65a30d", color: "#d9f99d" };
          case "stroke":    return { bg: "var(--color-card)", border: "var(--color-border-strong)", color: "#cbd5e1" };
          case "recovery":  return { bg: "#064e3b", border: "#10b981", color: "#a7f3d0" };
          case "equipment": return { bg: "#7c2d12", border: "#ea580c", color: "#fed7aa" };
          default:          return { bg: "var(--color-border)", border: "var(--color-text-dim)", color: "#cbd5e1" };
        }
      };

      const canApply = parsed && parsed.tokens.length > 0;

      return (
        <div onClick={onClose}
          style={{
            position: "fixed", inset: 0, zIndex: 9000,
            background: "rgba(2,6,23,0.7)",
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            padding: "10vh 16px",
          }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 520,
              background: "var(--color-bg)", border: "1px solid var(--color-card)",
              borderRadius: 14, padding: "22px 22px 18px",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ color: "var(--color-text)", fontSize: 17, margin: 0, fontWeight: 700 }}>Quick Input</h3>
              <button onClick={onClose} aria-label="Close"
                style={{ background: "transparent", border: "none", color: "var(--color-text-dim)", fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
            </div>
            <p style={{ color: "var(--color-text-muted)", fontSize: 12, margin: "0 0 10px", lineHeight: 1.4 }}>
              Type a coach-style one-liner. We'll extract what we recognize and let you confirm before applying.
            </p>

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={e => { setText(e.target.value); setParsed(null); }}
                onKeyDown={e => { if (e.key === "Enter") handleParse(); if (e.key === "Escape") onClose(); }}
                aria-label="Workout intent"
                placeholder='e.g. "easy 2k aerobic"'
                style={{
                  flex: 1, padding: "9px 12px", borderRadius: 8,
                  border: "1px solid var(--color-border)", background: "var(--color-card)",
                  color: "var(--color-text)", fontSize: 14, outline: "none",
                }}
              />
              <button onClick={handleParse}
                style={{
                  padding: "9px 16px", borderRadius: 8, border: "1px solid var(--color-primary)",
                  background: "#1d4ed8", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>Parse</button>
            </div>

            {/* Examples row — clickable to fill the input */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              <span style={{ color: "var(--color-border-strong)", fontSize: 11, alignSelf: "center" }}>Try:</span>
              {examples.map(ex => (
                <button key={ex} onClick={() => { setText(ex); setParsed(null); }}
                  style={{
                    padding: "3px 9px", borderRadius: 12, border: "1px solid var(--color-border)",
                    background: "transparent", color: "var(--color-text-muted)", fontSize: 11, cursor: "pointer",
                    fontStyle: "italic",
                  }}>"{ex}"</button>
              ))}
            </div>

            {/* Parsed-tokens preview */}
            {parsed && (
              <div style={{ borderTop: "1px solid var(--color-card)", paddingTop: 12, marginBottom: 14 }}>
                <div style={{ color: "var(--color-text-dim)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  Parsed ({parsed.tokens.length})
                </div>
                {parsed.tokens.length === 0 ? (
                  <div style={{ color: "var(--color-text-muted)", fontSize: 13, fontStyle: "italic" }}>
                    Nothing recognized. Try one of the examples above, or check supported vocabulary in the manual.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {parsed.tokens.map((tok, i) => {
                      const c = colorFor(tok);
                      return (
                        <span key={i} title={`Matched: "${tok.raw}"`}
                          style={{
                            padding: "4px 10px", borderRadius: 999,
                            background: c.bg, border: `1px solid ${c.border}`,
                            color: c.color, fontSize: 12, fontWeight: 600,
                          }}>
                          {labelFor(tok)}
                        </span>
                      );
                    })}
                  </div>
                )}
                {parsed.unparsed && (
                  <div style={{ marginTop: 8, color: "var(--color-text-dim)", fontSize: 12, fontStyle: "italic" }}>
                    Not recognized: "{parsed.unparsed}"
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={onClose}
                style={{
                  padding: "8px 14px", borderRadius: 8, border: "1px solid var(--color-border)",
                  background: "transparent", color: "var(--color-text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>Cancel</button>
              <button onClick={handleApply} disabled={!canApply}
                style={{
                  padding: "8px 18px", borderRadius: 8, border: "none",
                  background: canApply ? "#16a34a" : "var(--color-border)",
                  color: canApply ? "#fff" : "var(--color-text-dim)",
                  fontSize: 13, fontWeight: 700, cursor: canApply ? "pointer" : "not-allowed",
                }}>Apply</button>
            </div>
          </div>
        </div>
      );
    }
