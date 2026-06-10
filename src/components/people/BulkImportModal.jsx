// src/components/people/BulkImportModal.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders } from "../../lib/api.js";
import { csvParseSwimmers, downloadTemplate, normalizeImportRow } from "../../lib/workout-helpers.js";

    const { useState } = React;

    export function BulkImportModal({ teams = [], onClose, onImported }) {
      const [text,    setText]    = React.useState("");
      const [parsed,  setParsed]  = React.useState(null);                    // null = unparsed; [] = empty; [{idx, raw, norm}] = parsed
      const [result,  setResult]  = React.useState(null);                    // server response after submit
      const [submitting, setSubmitting] = React.useState(false);
      const [err,     setErr]     = React.useState(null);
      // Batch-level team picker. Default: coach's only team if there's exactly
      // one; otherwise empty ("no team"). All imported swimmers in this run
      // get the same team affiliation. Per-row team_id NOT supported (would
      // require a column in the CSV; over-engineered for v1).
      const [teamId,  setTeamId]  = React.useState(() => (teams.length === 1 ? teams[0].id : ""));

      const onFile = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => { setText(String(reader.result || "")); setParsed(null); setResult(null); setErr(null); };
        reader.onerror = () => setErr("Could not read file.");
        reader.readAsText(f);
      };

      const parse = () => {
        setErr(null); setResult(null);
        const p = csvParseSwimmers(text);
        if (!p.ok) { setErr(p.error); setParsed(null); return; }
        const rows = p.dataRows.map((raw, idx) => {
          const v = normalizeImportRow(raw);
          return { idx, raw, normalized: v.ok ? v.normalized : null, error: v.ok ? null : v.error, warning: v.ok ? (v.warning || null) : null };
        });
        setParsed(rows);
      };

      const submit = async () => {
        if (!parsed) return;
        const validRows = parsed.filter(r => !r.error).map(r => r.normalized);
        if (validRows.length === 0) { setErr("No valid rows to import."); return; }
        setSubmitting(true); setErr(null);
        try {
          const res = await fetch("/api/managed-swimmers/bulk", {
            method:  "POST",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ rows: validRows, team_id: teamId || null }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
          setResult(j);
          if (onImported) onImported(j);
        } catch (e) { setErr(e.message); }
        finally { setSubmitting(false); }
      };

      const validCount   = parsed ? parsed.filter(r => !r.error).length : 0;
      const invalidCount = parsed ? parsed.filter(r =>  r.error).length : 0;
      const warnCount    = parsed ? parsed.filter(r => !r.error && r.warning).length : 0;

      return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16, overflow: "auto" }}>
          <div style={{ background: "var(--color-card)", border: "1px solid var(--color-border-strong)", borderRadius: 12, padding: 22, maxWidth: 720, width: "100%", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <h3 style={{ color: "var(--color-text)", margin: 0 }}>📥 Bulk import swimmers</h3>
              <button onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", color: "var(--color-text-muted)", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            {result ? (
              <div>
                <div style={{ padding: "12px 14px", background: "#22c55e22", border: "1px solid #22c55e", borderRadius: 8, marginBottom: 12 }}>
                  <div style={{ color: "var(--color-positive)", fontWeight: 700, fontSize: 14 }}>Imported {result.inserted} swimmer{result.inserted === 1 ? "" : "s"}</div>
                  {result.errors && result.errors.length > 0 && (
                    <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 6 }}>
                      {result.errors.length} row{result.errors.length === 1 ? "" : "s"} rejected by server:
                      <ul style={{ margin: "4px 0 0 20px", padding: 0 }}>
                        {result.errors.map(e => (
                          <li key={e.row_idx}>Row {e.row_idx + 1}: {e.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <button onClick={onClose}
                  style={{ padding: "7px 14px", background: "var(--color-primary)", color: "var(--color-bg)", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 10, lineHeight: 1.5 }}>
                  Required: <code>first_name</code> + <code>dob</code> (<code>last_name</code> recommended). Optional: <code>preferred_name</code>, <code>initials</code>, <code>gender</code>, <code>pace_scy_100</code>, <code>pace_scm_100</code>, <code>pace_lcm_100</code>, <code>parental_contact</code>. A legacy single <code>name</code> column still works — it's split on the last space, flagged with a ⚠ so you can verify. Headers are case-insensitive; extra columns are ignored. DOB accepts <code>YYYY-MM-DD</code> or <code>MM/DD/YYYY</code>.
                </div>

                {teams.length > 0 && (
                  <div style={{ background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 6, padding: 10, marginBottom: 10 }}>
                    <label style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block", marginBottom: 4 }}>Attach all imported swimmers to:</label>
                    <select value={teamId} onChange={e => setTeamId(e.target.value)}
                      aria-label="Attach all imported swimmers to team"
                      style={{ width: "100%", padding: "6px 10px", fontSize: 13, background: "var(--color-card)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 }}>
                      <option value="">— no team (free-floating roster) —</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ padding: "5px 11px", background: "var(--color-border)", color: "#cbd5e1", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                    📁 Choose CSV file
                    <input type="file" accept=".csv,.tsv,.txt" onChange={onFile} style={{ display: "none" }} />
                  </label>
                  <button onClick={downloadTemplate}
                    style={{ padding: "5px 11px", background: "transparent", color: "var(--color-primary-text)", border: "1px solid var(--color-primary)", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
                    📄 Download template
                  </button>
                </div>

                <label style={{ display: "block", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 4 }}>Or paste CSV/TSV here:</label>
                <textarea value={text} onChange={e => { setText(e.target.value); setParsed(null); setErr(null); }}
                  aria-label="Paste CSV or TSV"
                  placeholder="first_name,last_name,preferred_name,dob,gender,initials,pace_scy_100,pace_scm_100,pace_lcm_100,parental_contact&#10;Sarah,Johnson,,2010-03-15,F,SJ,2:05,,,parent@example.com"
                  rows={8}
                  style={{ width: "100%", padding: "8px 10px", fontSize: 12, fontFamily: "monospace", background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6, resize: "vertical", boxSizing: "border-box" }} />

                <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
                  <button onClick={parse} disabled={!text.trim()}
                    style={{ padding: "6px 14px", background: text.trim() ? "var(--color-primary)" : "var(--color-border-strong)", color: text.trim() ? "var(--color-bg)" : "var(--color-text-muted)", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: text.trim() ? "pointer" : "not-allowed" }}>
                    Parse
                  </button>
                  {parsed && (
                    <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                      {validCount} valid · {invalidCount > 0 ? <span style={{ color: "#fca5a5" }}>{invalidCount} invalid</span> : "0 invalid"}
                      {warnCount > 0 && <span style={{ color: "#f59e0b" }}> · {warnCount} name-split ⚠</span>}
                    </span>
                  )}
                </div>

                {err && <div style={{ color: "#fca5a5", fontSize: 12, marginTop: 8 }}>{err}</div>}

                {parsed && parsed.length > 0 && (
                  <div style={{ marginTop: 14, maxHeight: 260, overflow: "auto", border: "1px solid var(--color-border)", borderRadius: 6 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead style={{ background: "var(--color-bg)", position: "sticky", top: 0 }}>
                        <tr>
                          <th style={{ padding: "6px 8px", textAlign: "left", color: "var(--color-text-muted)", fontWeight: 700 }}>#</th>
                          <th style={{ padding: "6px 8px", textAlign: "left", color: "var(--color-text-muted)", fontWeight: 700 }}>Status</th>
                          <th style={{ padding: "6px 8px", textAlign: "left", color: "var(--color-text-muted)", fontWeight: 700 }}>Name</th>
                          <th style={{ padding: "6px 8px", textAlign: "left", color: "var(--color-text-muted)", fontWeight: 700 }}>DOB</th>
                          <th style={{ padding: "6px 8px", textAlign: "left", color: "var(--color-text-muted)", fontWeight: 700 }}>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.map(row => (
                          <tr key={row.idx} style={{ background: row.error ? "#dc262611" : "transparent", borderTop: "1px solid var(--color-border)" }}>
                            <td style={{ padding: "5px 8px", color: "var(--color-text-dim)" }}>{row.idx + 1}</td>
                            <td style={{ padding: "5px 8px" }}>
                              {row.error
                                ? <span style={{ color: "var(--color-destructive-text)" }}>✗</span>
                                : row.warning
                                  ? <span style={{ color: "#f59e0b" }}>⚠</span>
                                  : <span style={{ color: "var(--color-positive)" }}>✓</span>}
                            </td>
                            <td style={{ padding: "5px 8px", color: "var(--color-text)" }}>
                              {row.raw.first_name ? `${row.raw.first_name} ${row.raw.last_name || ""}`.trim() : (row.raw.name || "—")}
                            </td>
                            <td style={{ padding: "5px 8px", color: "#cbd5e1", fontFamily: "monospace" }}>
                              {row.normalized?.dob || row.raw.dob || "—"}
                            </td>
                            <td style={{ padding: "5px 8px", color: row.error ? "#fca5a5" : (row.warning ? "#f59e0b" : "var(--color-text-dim)"), fontSize: 11 }}>
                              {row.error || row.warning || (row.normalized?.initials ? `initials: ${row.normalized.initials}` : "")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {parsed && parsed.length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={submit} disabled={submitting || validCount === 0}
                      style={{ padding: "7px 14px", background: validCount > 0 ? "var(--color-positive)" : "var(--color-border-strong)", color: validCount > 0 ? "var(--color-bg)" : "var(--color-text-muted)", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: (validCount > 0 && !submitting) ? "pointer" : "not-allowed" }}>
                      {submitting ? "Importing…" : `Import ${validCount} swimmer${validCount === 1 ? "" : "s"}`}
                    </button>
                    <button onClick={onClose}
                      style={{ padding: "7px 14px", background: "var(--color-border)", color: "#cbd5e1", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      );
    }
