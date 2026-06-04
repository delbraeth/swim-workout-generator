// src/components/history/SaveToHistoryForm.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { normalizeInitials } from "../../lib/shared.js";
import { StarRating } from "../StarRating.jsx";

    export function SaveToHistoryForm({ dateDraft, setDateDraft, initialsDraft, setInitialsDraft, noteDraft, setNoteDraft, difficultyDraft, setDifficultyDraft, saveStatus, saveError, onSave }) {
      const isSaved  = saveStatus === "saved";
      const isSaving = saveStatus === "saving";
      return (
        <div className="screen-only" style={{ marginTop: 20, background: "var(--color-card)", borderRadius: 12, padding: 18, border: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-text)" }}>📒 Log this workout</span>
            <span style={{ fontSize: 11, color: "var(--color-text-dim)" }}>(saves to your history)</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "150px 90px 1fr", gap: 12, alignItems: "start" }}>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Date Performed</label>
              <input type="date" value={dateDraft} onChange={e => setDateDraft(e.target.value)} disabled={isSaving}
                style={{ width: "100%", padding: "8px 10px", background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6, fontSize: 13, fontFamily: "inherit", colorScheme: "dark" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Initials</label>
              <input type="text" value={initialsDraft}
                onChange={e => setInitialsDraft(normalizeInitials(e.target.value))}
                disabled={isSaving}
                placeholder="e.g. CD"
                maxLength={4}
                style={{ width: "100%", padding: "8px 10px", background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6, fontSize: 13, fontFamily: "inherit", textTransform: "uppercase", letterSpacing: "0.05em" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Notes (optional)</label>
              <textarea value={noteDraft} onChange={e => setNoteDraft(e.target.value)} disabled={isSaving}
                placeholder="How did it go? Anything to remember?"
                rows={2}
                style={{ width: "100%", padding: "8px 10px", background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 6, fontSize: 13, fontFamily: "inherit", resize: "vertical" }} />
            </div>
          </div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ fontSize: 10, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Difficulty</label>
            <StarRating value={difficultyDraft} onChange={setDifficultyDraft} />
            <span style={{ fontSize: 11, color: "var(--color-text-dim)" }}>{difficultyDraft ? `${difficultyDraft}/5` : "optional"}</span>
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button onClick={onSave} disabled={isSaving}
              style={{
                padding: "9px 20px", borderRadius: 8, border: "none",
                background: isSaved ? "#16a34a" : "var(--color-primary)", color: "#fff",
                fontWeight: 700, fontSize: 13,
                cursor: isSaving ? "wait" : "pointer", opacity: isSaving ? 0.8 : 1,
              }}>
              {isSaving ? "Saving…" : isSaved ? "✓ Saved" : "💾 Save to History"}
            </button>
            {isSaved && (
              <span style={{ color: "#86efac", fontSize: 12 }}>
                Logged. (commit may take ~30–60s to appear in the repo)
              </span>
            )}
            {saveStatus === "error" && (
              <span style={{ color: "#fca5a5", fontSize: 12 }}>
                Save failed: {saveError}. Click Save again to retry.
              </span>
            )}
          </div>
        </div>
      );
    }
