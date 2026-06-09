// src/components/shell/SignInGate.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components imported below (freevars-driven).

    export function SignInGate({ authError }) {
      // Provider-neutral invite landing: an invite URL of the form
      // setforge.io/?invite=CODE lets the user pick Apple OR Google,
      // and we forward the code to whichever auth start route they tap.
      // Used by AdminInvites "Copy link" (which now emits /?invite=CODE
      // instead of provider-specific /api/auth/apple?invite=CODE).
      const inviteParam = (typeof window !== "undefined")
        ? (new URLSearchParams(window.location.search).get("invite") || "")
        : "";
      const appleHref  = inviteParam ? `/api/auth/apple?invite=${encodeURIComponent(inviteParam)}`   : "/api/auth/apple";
      const googleHref = inviteParam ? `/api/auth/google?invite=${encodeURIComponent(inviteParam)}`  : "/api/auth/google";
      return (
        <div style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, var(--color-bg) 0%, #1e3a5f 50%, var(--color-bg) 100%)",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          display: "flex", flexDirection: "column",
        }}>
          {/* ─── Top bar: wordmark left, nav right ─── */}
          <header style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "20px 32px",
            maxWidth: 1200, width: "100%", margin: "0 auto", boxSizing: "border-box",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src="/icons/icon-512.svg" alt="SetForge logo" width="36" height="36" />
              <span style={{
                fontFamily: '"Inter Tight", Inter, sans-serif', fontSize: 22, fontWeight: 800,
                color: "#fff", letterSpacing: "-0.02em",
              }}>SetForge</span>
            </div>
            <nav aria-label="Marketing pages" style={{ display: "flex", gap: 18, fontSize: 14 }}>
              <a href="/pricing.html" style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>Pricing</a>
              <a href="/about.html"   style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>About</a>
              <a href="/security.html"style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>Security</a>
              <a href="/manual.html"  style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>Manual</a>
            </nav>
          </header>

          {/* ─── Hero: 2-col on desktop, 1-col on mobile ─── */}
          <main style={{
            flex: 1, display: "grid", gap: 48, alignItems: "center",
            padding: "32px 32px 64px", maxWidth: 1200, width: "100%",
            margin: "0 auto", boxSizing: "border-box",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          }} className="signin-hero-grid">
            {/* ─── Left col: value prop + CTAs ─── */}
            <div>
              <h1 style={{
                fontFamily: '"Inter Tight", Inter, sans-serif',
                fontSize: "clamp(40px, 6vw, 64px)", fontWeight: 800,
                color: "#fff", margin: "0 0 16px", letterSpacing: "-0.03em",
                lineHeight: 1.05,
              }}>
                Swim workouts<br />in seconds.
              </h1>
              <p style={{
                color: "var(--color-text)", fontSize: 18, lineHeight: 1.5,
                margin: "0 0 32px", maxWidth: 480,
              }}>
                Generator and pace clock for coaches and their swimmers. Built by one swim coach; honest about what it is and isn't.
              </p>

              {/* Three value props */}
              <ul style={{
                listStyle: "none", padding: 0, margin: "0 0 36px",
                display: "flex", flexDirection: "column", gap: 12,
              }}>
                {[
                  { icon: "🆓", text: <><strong style={{color:"#fff"}}>Free for swimmers, forever.</strong> Written into our Terms — not just a marketing promise.</> },
                  { icon: "🛡️", text: <><strong style={{color:"#fff"}}>No ads, no trackers, no passwords.</strong> OAuth sign-in only; we can't lose what we never had.</> },
                  { icon: "✉️", text: <><strong style={{color:"#fff"}}>Coach pricing TBD. One person answers the email.</strong> No support queue, no enterprise sales call.</> },
                ].map((vp, i) => (
                  <li key={i} style={{
                    display: "flex", gap: 12, alignItems: "flex-start",
                    color: "var(--color-text-muted)", fontSize: 15, lineHeight: 1.5,
                  }}>
                    <span aria-hidden="true" style={{ fontSize: 18, flexShrink: 0 }}>{vp.icon}</span>
                    <span>{vp.text}</span>
                  </li>
                ))}
              </ul>

              {/* Auth-error surface — preserved from prior SignInGate */}
              {authError && (
                <div role="alert" style={{
                  color: "#f87171", fontSize: 13, marginBottom: 20,
                  background: "rgba(239,68,68,0.1)", borderRadius: 8, padding: "10px 14px",
                  maxWidth: 360,
                }}>
                  {authError === "not_authorized"
                    ? "Your account isn't on the access list. Email hello@competitionaquatics.com to request an invite."
                    : "Sign-in failed — please try again."}
                </div>
              )}

              {/* CTAs: primary Sign in (existing flow), secondary Request invite */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <a href={appleHref} style={{ textDecoration: "none" }} aria-label="Sign in with Apple">
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    background: "#fff", color: "#000", borderRadius: 12,
                    padding: "14px 28px", fontSize: 17, fontWeight: 600,
                    cursor: "pointer", userSelect: "none",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    minHeight: 48,
                  }}>
                    <svg width="20" height="20" viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true">
                      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105-37.3-155.8-109.3C107.3 729.3 75 608.4 75 490.5c0-173.5 113.4-265.5 224.8-265.5 58.2 0 106.8 38.9 142.5 38.9 33.8 0 87.4-41.2 154.5-41.2 24.5 0 108.2 3.9 161.7 59.4zm-326.3-191.4c30.6-35.8 52.4-85.6 52.4-135.4 0-6.9-.6-13.9-1.9-19.5-49.6 1.9-108.9 33.1-145.5 73.8-27.5 30.1-53.1 79.7-53.1 130.3 0 7.5 1.3 15 1.9 17.4 3.2.6 8.4 1.3 13.6 1.3 44.6 0 100.7-29.5 132.6-67.9z"/>
                    </svg>
                    Sign in with Apple
                  </div>
                </a>
                {/* Sign in with Google (Phase 2 · GOOGLE_OAUTH_SCOPE.md).
                    Same redirect pattern as Apple. White button with the
                    multicolor "G" mark — Google's official identity guidelines
                    permit the white-on-white variant when the wordmark is
                    "Sign in with Google" verbatim. */}
                <a href={googleHref} style={{ textDecoration: "none" }} aria-label="Sign in with Google">
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    background: "#fff", color: "#1f1f1f", borderRadius: 12,
                    padding: "14px 28px", fontSize: 17, fontWeight: 500,
                    fontFamily: '"Roboto", "Helvetica Neue", Arial, sans-serif',
                    cursor: "pointer", userSelect: "none",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    minHeight: 48,
                  }}>
                    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                      <path fill="none" d="M0 0h48v48H0z"/>
                    </svg>
                    Sign in with Google
                  </div>
                </a>
                {/* Tertiary CTA: mailto fallback for users who don't have an
                    invite yet. After Google OAuth lands, the invite-gate stays
                    in place (per GOOGLE_OAUTH_SCOPE.md decision 5). */}
                <a href="mailto:hello@competitionaquatics.com?subject=SetForge%20invite%20request&body=Hi%20%E2%80%94%20I'd%20like%20an%20invite%20to%20SetForge.%20A%20bit%20about%20me%3A%20"
                   style={{
                     color: "var(--color-text)", fontSize: 14, fontWeight: 600,
                     textDecoration: "none", padding: "14px 16px",
                     border: "1px solid var(--color-border)", borderRadius: 12,
                     minHeight: 48, display: "inline-flex", alignItems: "center",
                   }}>
                  No invite? Request one →
                </a>
              </div>

              <div style={{ marginTop: 24, fontSize: 12, color: "var(--color-text-dim)" }}>
                By signing in you agree to our{" "}
                <a href="/terms.html" style={{ color: "var(--color-text-muted)", textDecoration: "underline" }}>Terms</a>
                {" "}and{" "}
                <a href="/privacy.html" style={{ color: "var(--color-text-muted)", textDecoration: "underline" }}>Privacy Policy</a>.
              </div>
            </div>

            {/* ─── Right col: visual proof. STYLIZED MOCK — Cap'n homework:
                 replace with a real screenshot when available. PHASED_PLAN
                 §8 open follow-up. ─── */}
            <div style={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              fontSize: 13,
              color: "var(--color-text)",
              lineHeight: 1.6,
            }}>
              {/* Fake browser/window chrome */}
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                <span style={{ width: 11, height: 11, borderRadius: 999, background: "#ef4444" }} aria-hidden="true"></span>
                <span style={{ width: 11, height: 11, borderRadius: 999, background: "#f59e0b" }} aria-hidden="true"></span>
                <span style={{ width: 11, height: 11, borderRadius: 999, background: "#22c55e" }} aria-hidden="true"></span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--color-text-dim)" }}>setforge.io · Generate</span>
              </div>
              {/* Header pills row */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, fontSize: 11 }}>
                <span style={{ padding: "3px 10px", borderRadius: 999, background: "rgba(59,130,246,0.18)", color: "var(--color-primary-text)", fontWeight: 700 }}>🏊 Distance</span>
                <span style={{ padding: "3px 10px", borderRadius: 999, background: "rgba(34,197,94,0.18)", color: "var(--color-positive)", fontWeight: 700 }}>3,200 yd · ~52 min</span>
                <span style={{ padding: "3px 10px", borderRadius: 999, background: "rgba(245,158,11,0.18)", color: "var(--color-warn)", fontWeight: 700 }}>🏊‍♂️ 3 lanes</span>
              </div>
              {/* Generated workout block */}
              <div style={{ borderTop: "1px solid var(--color-border)", paddingTop: 12 }}>
                <div style={{ color: "#fff", fontWeight: 700, marginBottom: 8 }}>
                  Main · Threshold ladder ⚡
                  <span style={{ color: "var(--color-text-dim)", fontWeight: 400, fontSize: 11, marginLeft: 8 }}>1,800 yd</span>
                </div>
                <div style={{ color: "var(--color-text-muted)", fontSize: 12 }}>
                  3 × 200 free <span style={{color:"var(--color-text-dim)"}}>@ 3:00</span> · descend 1→3<br />
                  4 × 100 free <span style={{color:"var(--color-text-dim)"}}>@ 1:30</span> · hold 200 pace<br />
                  8 × 50 free  <span style={{color:"var(--color-text-dim)"}}>@&nbsp;:45</span> · build each<br />
                  4 × 25 sprint<span style={{color:"var(--color-text-dim)"}}>@&nbsp;:30</span> · all out
                </div>
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--color-border)",
                            display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--color-text-dim)" }}>
                <span>★ Favorite</span>
                <span>⇄ Regenerate</span>
                <span>📥 Save to My Sets</span>
              </div>
            </div>
          </main>

          {/* ─── Footer micro-nav ─── */}
          <footer style={{
            borderTop: "1px solid var(--color-border)",
            padding: "20px 32px",
            color: "var(--color-text-dim)",
            fontSize: 12,
            display: "flex", flexWrap: "wrap", gap: 16,
            justifyContent: "space-between", alignItems: "center",
            maxWidth: 1200, width: "100%", margin: "0 auto", boxSizing: "border-box",
          }}>
            <div>© 2026 Competition Aquatics, LLC</div>
            <nav aria-label="Footer" style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
              <a href="/changelog.html"      style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>Changelog</a>
              <a href="/sub-processors.html" style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>Sub-processors</a>
              <a href="/privacy.html"        style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>Privacy</a>
              <a href="/terms.html"          style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>Terms</a>
              <a href="mailto:hello@competitionaquatics.com" style={{ color: "var(--color-text-muted)", textDecoration: "none" }}>hello@competitionaquatics.com</a>
            </nav>
          </footer>

          {/* Hero collapses to single column on narrow viewports. Inline so
              we don't have to wire a separate stylesheet for one rule. */}
          <style>{`
            @media (max-width: 880px) {
              .signin-hero-grid { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </div>
      );
    }
