// src/components/admin/AdminView.jsx — extracted from src/app.jsx (SPA-split Phase 3).
// React is a runtime global. Shared helpers/components are imported below (freevars-driven).
import { AdminUsers } from "./AdminUsers.jsx";
import { AdminPendingUgc } from "./AdminPendingUgc.jsx";
import { AdminPublicUgc } from "./AdminPublicUgc.jsx";
import { AdminFeedback } from "./AdminFeedback.jsx";
import { AdminEmailTest } from "./AdminEmailTest.jsx";
import { AdminBillingConfig } from "./AdminBillingConfig.jsx";
import { AdminVendorKit } from "./AdminVendorKit.jsx";
import { AdminAudit } from "./AdminAudit.jsx";
import { AdminInvites } from "./AdminInvites.jsx";

    const { useState } = React;

    export function AdminView({ me, onStartImpersonation }) {
      const [tab, setTab] = React.useState("users");

      const tabStyle = (active) => ({
        padding: "8px 16px", border: "none", borderRadius: 8,
        background: active ? "var(--color-primary)" : "var(--color-card)",
        color: active ? "var(--color-bg)" : "var(--color-text-muted)",
        fontSize: 13, fontWeight: 700, cursor: "pointer",
        marginRight: 8,
      });

      return (
        <div>
          <h2 style={{ color: "var(--color-text)", marginTop: 0 }}>🛡 Admin</h2>
          <div style={{ marginBottom: 20 }}>
            <button onClick={() => setTab("users")}    style={tabStyle(tab === "users")}>Users</button>
            <button onClick={() => setTab("invites")}  style={tabStyle(tab === "invites")}>Invites</button>
            <button onClick={() => setTab("feedback")} style={tabStyle(tab === "feedback")}>Feedback</button>
            <button onClick={() => setTab("pending-ugc")} style={tabStyle(tab === "pending-ugc")}>Pending UGC</button>
            <button onClick={() => setTab("public-ugc")}  style={tabStyle(tab === "public-ugc")}>Public UGC</button>
            <button onClick={() => setTab("email")}      style={tabStyle(tab === "email")}>Email test</button>
            <button onClick={() => setTab("billing")}    style={tabStyle(tab === "billing")}>Billing config</button>
            <button onClick={() => setTab("vendor-kit")} style={tabStyle(tab === "vendor-kit")}>Vendor kit</button>
            <button onClick={() => setTab("audit")}      style={tabStyle(tab === "audit")}>Audit log</button>
          </div>
          {tab === "users"       && <AdminUsers me={me} onStartImpersonation={onStartImpersonation} />}
          {tab === "invites"     && <AdminInvites />}
          {tab === "feedback"    && <AdminFeedback />}
          {tab === "pending-ugc" && <AdminPendingUgc />}
          {tab === "public-ugc"  && <AdminPublicUgc />}
          {tab === "email"       && <AdminEmailTest />}
          {tab === "billing"     && <AdminBillingConfig />}
          {tab === "vendor-kit"  && <AdminVendorKit />}
          {tab === "audit"       && <AdminAudit />}
        </div>
      );
    }
