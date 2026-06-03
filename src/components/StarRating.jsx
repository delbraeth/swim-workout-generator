// src/components/StarRating.jsx — pure presentational 1–5 star rating control.
// Extracted from src/app.jsx (SPA-split Phase 3). React is a runtime global
// (provided by the CDN <script> in index.html); no import needed for JSX.

export function StarRating({ value, onChange, size = 18, readOnly = false, allowToggleClear = true, showClear = false }) {
  // value: null or 1..5
  // allowToggleClear: when true, clicking the current-value star sets back to null
  //                   when false, clicking always sets to N (no toggle-off)
  // showClear: when true and editable, render a small × clear button when a value is set
  return (
    <div style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
      {[1,2,3,4,5].map(n => {
        const filled = value != null && n <= value;
        return (
          <span key={n}
            onClick={readOnly ? undefined : () => onChange(allowToggleClear && value === n ? null : n)}
            title={readOnly ? `${value || 0}/5` : `${n} star${n>1?'s':''}`}
            style={{
              fontSize: size, lineHeight: 1, cursor: readOnly ? "default" : "pointer",
              color: filled ? "var(--color-warn)" : "var(--color-border-strong)",
              transition: "color 0.1s",
              userSelect: "none",
            }}>★</span>
        );
      })}
      {!readOnly && showClear && value != null && (
        <span onClick={() => onChange(null)}
          title="Clear rating"
          style={{
            marginLeft: 4, fontSize: Math.max(10, size - 4), lineHeight: 1,
            cursor: "pointer", color: "var(--color-text-dim)", userSelect: "none",
            padding: "0 4px", borderRadius: 4,
          }}>✕</span>
      )}
    </div>
  );
}
