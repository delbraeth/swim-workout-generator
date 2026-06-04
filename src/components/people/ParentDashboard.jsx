// src/components/people/ParentDashboard.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).
import { csrfHeaders } from "../../app.jsx";
import { Stat } from "../Stat.jsx";
import { AddressManager } from "./AddressManager.jsx";
import { HouseholdSiblings } from "./HouseholdSiblings.jsx";

    const { useState, useEffect } = React;

    export function ParentDashboard({ me }) {
      const [swimmers,    setSwimmers]    = React.useState(null);   // null = loading
      const [thisWeek,    setThisWeek]    = React.useState(null);   // digest of week just ended
      const [selectedId,  setSelectedId]  = React.useState(null);   // managed_id or swimmer_sub
      const [paused,      setPaused]      = React.useState(!!me?.digest_paused);
      const [savingPause, setSavingPause] = React.useState(false);
      const [msg,         setMsg]         = React.useState(null);

      React.useEffect(() => {
        let cancelled = false;
        (async () => {
          try {
            const [swRes, dgRes] = await Promise.all([
              fetch("/api/parent/swimmers", { cache: "no-store" }),
              fetch("/api/parent/digest",   { cache: "no-store" }),
            ]);
            if (!swRes.ok) throw new Error(`HTTP ${swRes.status} (swimmers)`);
            const sw = await swRes.json();
            if (cancelled) return;
            setSwimmers(Array.isArray(sw) ? sw : []);
            if (sw.length > 0) {
              setSelectedId(sw[0].managed_id || sw[0].swimmer_sub);
            }
            if (dgRes.ok) {
              const d = await dgRes.json();
              setThisWeek(d);
            }
          } catch (e) {
            if (!cancelled) { setSwimmers([]); setMsg(e.message); }
          }
        })();
        return () => { cancelled = true; };
      }, []);

      const togglePause = async () => {
        if (savingPause) return;
        setSavingPause(true); setMsg(null);
        const next = !paused;
        try {
          const res = await fetch("/api/parent/settings", {
            method:  "PATCH",
            headers: { "Content-Type": "application/json", ...csrfHeaders() },
            body:    JSON.stringify({ digest_paused: next }),
          });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || `HTTP ${res.status}`);
          }
          setPaused(next);
        } catch (e) {
          setMsg(`Couldn't update digest preference: ${e.message}`);
        } finally {
          setSavingPause(false);
        }
      };

      if (swimmers === null) {
        return <div style={{ color: "var(--color-text-dim)", fontSize: 13, padding: 24 }}>Loading…</div>;
      }
      if (swimmers.length === 0) {
        return (
          <div>
            <h2 style={{ color: "var(--color-text)", marginTop: 0 }}>👪 Parent view</h2>
            <div className="card" style={{ padding: 20, borderRadius: 10, color: "var(--color-text-dim)", fontSize: 14, lineHeight: 1.6 }}>
              <p style={{ marginTop: 0 }}>
                No swimmers linked yet. Once a coach finishes the invite
                process, your swimmer will show up here with their weekly
                recap and what's coming up.
              </p>
              <p style={{ marginBottom: 0, color: "var(--color-text-muted)", fontSize: 13 }}>
                If you weren't expecting to see this view, you can ignore it
                — nothing changes for your account.
              </p>
            </div>
          </div>
        );
      }

      const blocks = (thisWeek && Array.isArray(thisWeek.swimmers)) ? thisWeek.swimmers : [];
      const selected = swimmers.find(s => (s.managed_id || s.swimmer_sub) === selectedId) || swimmers[0];
      const block = blocks.find(b => {
        const bid = b.swimmer?.managed_id || b.swimmer?.swimmer_sub;
        return bid === (selected.managed_id || selected.swimmer_sub);
      });

      return (
        <div>
          <h2 style={{ color: "var(--color-text)", marginTop: 0 }}>
            👪 Parent view
            <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 500, color: "var(--color-text-muted)" }}>
              ({swimmers.length} {swimmers.length === 1 ? "swimmer" : "swimmers"})
            </span>
          </h2>

          {/* Swimmer selector */}
          {swimmers.length > 1 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {swimmers.map(s => {
                const sid = s.managed_id || s.swimmer_sub;
                const active = sid === selectedId;
                return (
                  <button key={sid}
                    onClick={() => setSelectedId(sid)}
                    style={{
                      padding: "6px 12px", borderRadius: 999,
                      border: "1px solid " + (active ? "var(--color-primary)" : "var(--color-border)"),
                      background: active ? "var(--color-primary)" : "var(--color-card)",
                      color: active ? "var(--color-bg)" : "var(--color-text)",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}>
                    {s.display_name || s.initials || "Swimmer"}
                    {s.age != null && <span style={{ marginLeft: 6, opacity: 0.75 }}>· {s.age}y</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* This week's recap card for the selected swimmer */}
          <div className="card" style={{ padding: 16, borderRadius: 10, marginBottom: 14 }}>
            <h3 style={{ color: "var(--color-text)", marginTop: 0, marginBottom: 4, fontSize: 15 }}>
              {selected.display_name || "Swimmer"}
            </h3>
            <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 12 }}>
              Last week (Mon–Sun){thisWeek?.weekStart ? ` · week of ${thisWeek.weekStart}` : ""}
            </div>
            {block ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                <Stat label="Workouts done"  value={`${block.done || 0} / ${block.assigned || 0}`} />
                <Stat label="Yardage"        value={(block.yardage || 0).toLocaleString()} />
                {block.attendance && block.attendance.total > 0 ? (
                  <Stat label="Attendance" value={`${block.attendance.done} / ${block.attendance.total}`} />
                ) : null}
                <Stat label="Next week" value={`${block.upcoming || 0} scheduled`} />
              </div>
            ) : (
              <div style={{ color: "var(--color-text-dim)", fontSize: 13, fontStyle: "italic" }}>
                No data yet for last week. Once the coach assigns workouts (or
                this swimmer logs their own), recaps will appear here.
              </div>
            )}
          </div>

          {/* Home address (Locations P2) — guardian manages + consent toggle.
              Household/siblings (P3) shown below it. */}
          <div className="card" style={{ padding: 14, borderRadius: 10, marginBottom: 14 }}>
            <AddressManager key={selected.managed_id || selected.swimmer_sub} swimmerRef={selected.managed_id || selected.swimmer_sub} showConsent={true} />
            <HouseholdSiblings key={"hh-" + (selected.managed_id || selected.swimmer_sub)} swimmerRef={selected.managed_id || selected.swimmer_sub} />
          </div>

          {/* Pause digest toggle */}
          <div className="card" style={{ padding: 14, borderRadius: 10, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ color: "var(--color-text)", fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                Weekly Sunday digest
              </div>
              <div style={{ color: "var(--color-text-muted)", fontSize: 12 }}>
                {paused
                  ? "Paused. You can still check this page anytime."
                  : "Sent Sunday evening (US-Eastern). Pause anytime."}
              </div>
            </div>
            <button onClick={togglePause}
              disabled={savingPause}
              style={{
                padding: "6px 12px", borderRadius: 8,
                border: "1px solid " + (paused ? "var(--color-primary)" : "var(--color-border)"),
                background: paused ? "var(--color-primary)" : "var(--color-card)",
                color: paused ? "var(--color-bg)" : "var(--color-text)",
                fontSize: 12, fontWeight: 700,
                cursor: savingPause ? "wait" : "pointer",
                opacity: savingPause ? 0.6 : 1,
              }}>
              {paused ? "▶ Resume" : "⏸ Pause"}
            </button>
          </div>

          {msg && <div style={{ color: "var(--color-warn)", fontSize: 12, marginTop: 10 }}>{msg}</div>}
        </div>
      );
    }
