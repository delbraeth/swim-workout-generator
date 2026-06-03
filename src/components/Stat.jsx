// src/components/Stat.jsx — tiny presentational stat tile (ParentDashboard etc.).
// Extracted from src/app.jsx (SPA-split Phase 3). React is a runtime global
// (provided by the CDN <script> in index.html); no import needed for JSX.

export function Stat({ label, value }) {
  return (
    <div style={{ background: "var(--color-card-alt, rgba(255,255,255,0.04))", borderRadius: 8, padding: 10, border: "1px solid var(--color-border)" }}>
      <div style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, color: "var(--color-text)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
