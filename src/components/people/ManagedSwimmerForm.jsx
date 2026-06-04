// src/components/people/ManagedSwimmerForm.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { DOB_MAX_TODAY, DOB_MIN, GENDER_OPTIONS } from "../../lib/shared.js";

    export function ManagedSwimmerForm({ form, setForm, teams }) {
      const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
      const inputStyle = { width: "100%", padding: "5px 9px", fontSize: 13, background: "var(--color-bg)", color: "var(--color-text)", border: "1px solid var(--color-border-strong)", borderRadius: 5 };
      const labelStyle = { display: "block", fontSize: 11, color: "var(--color-text-muted)", marginBottom: 3, marginTop: 8 };
      const teamOptions = Array.isArray(teams) ? teams : [];
      return (
        <div>
          <label style={{ ...labelStyle, marginTop: 0 }}>Display name *</label>
          <input value={form.display_name} onChange={e => upd("display_name", e.target.value)}
            placeholder="e.g. Sarah Johnson" style={inputStyle} />
          {teamOptions.length > 0 && (
            <>
              <label style={labelStyle}>Team affiliation</label>
              <select value={form.team_id || ""} onChange={e => upd("team_id", e.target.value)} style={inputStyle}>
                <option value="">— no team —</option>
                {teamOptions.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div>
              <label style={labelStyle}>Initials</label>
              <input value={form.initials} onChange={e => upd("initials", e.target.value)}
                placeholder="SJ" maxLength={4} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>DOB *</label>
              <input type="date" value={form.dob} onChange={e => upd("dob", e.target.value)}
                min={DOB_MIN} max={DOB_MAX_TODAY()} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Gender</label>
              <select value={form.gender || ""} onChange={e => upd("gender", e.target.value)} style={inputStyle}>
                {GENDER_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ fontSize: 10, color: "var(--color-text-dim)", marginTop: 4 }}>
            DOB is required to derive minor-protection rules. Stored privately; only the swimmer's age and minor status are surfaced. Gender is optional; used for heat assignment when groups land.
          </div>

          <label style={labelStyle}>Class year (graduation year)</label>
          <input value={form.class_year} onChange={e => upd("class_year", e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="e.g. 2027" maxLength={4} inputMode="numeric" style={inputStyle} />
          <div style={{ fontSize: 10, color: "var(--color-text-dim)", marginTop: 4 }}>
            Optional. Grade level is derived automatically from the graduation year.
          </div>

          <label style={labelStyle}>USA Swimming ID</label>
          <input value={form.usa_swimming_id} onChange={e => upd("usa_swimming_id", e.target.value)}
            placeholder="USA-S member ID (optional)" maxLength={255} style={inputStyle} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <div>
              <label style={labelStyle}>SCY 100 pace</label>
              <input value={form.pace_scy_100} onChange={e => upd("pace_scy_100", e.target.value)}
                placeholder="2:00" maxLength={8} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>SCM 100 pace</label>
              <input value={form.pace_scm_100} onChange={e => upd("pace_scm_100", e.target.value)}
                placeholder="2:10" maxLength={8} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>LCM 100 pace</label>
              <input value={form.pace_lcm_100} onChange={e => upd("pace_lcm_100", e.target.value)}
                placeholder="2:15" maxLength={8} style={inputStyle} />
            </div>
          </div>

          <label style={labelStyle}>Parental contact (email or phone, required for minors in high-school teams)</label>
          <input value={form.parental_contact} onChange={e => upd("parental_contact", e.target.value)}
            placeholder="parent@example.com" maxLength={255} style={inputStyle} />

          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 12, color: "#cbd5e1", cursor: "pointer" }}>
            <input type="checkbox" checked={!!form.parent_managed_flag}
              onChange={e => upd("parent_managed_flag", e.target.checked)} />
            <span>Parent-managed (blocks claim flow even for 13+)</span>
          </label>
        </div>
      );
    }
