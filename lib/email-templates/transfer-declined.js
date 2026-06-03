// Ownership-transfer "declined" template (OWNERSHIP_TRANSFER_SCOPE §3.7).
// Sent to the ORIGINAL OWNER when the proposed new owner declines. You remain
// the owner; nothing changed. Vars: teamName (string), signInUrl (optional).
export default function transferDeclined({ teamName, signInUrl }) {
  const team = teamName || "your team";
  const url  = signInUrl || "https://setforge.io";
  const text =
`Hi —

The coach you proposed as the new owner of ${team} declined. You remain the owner — nothing changed. You can propose a different admin anytime.

${url}

— Cap'n
(SetForge · https://setforge.io · Competition Aquatics, LLC)
`;
  const html =
`<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:16px;">
  <p>Hi —</p>
  <p>The coach you proposed as the new owner of <strong>${escapeHtml(team)}</strong> declined. You remain the owner — nothing changed. You can propose a different admin anytime.</p>
  <p style="margin:24px 0;"><a href="${url}" style="background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;display:inline-block;">Open SetForge</a></p>
  <p>— Cap'n</p>
  <p style="color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:24px;">SetForge · <a href="https://setforge.io" style="color:#6b7280;">setforge.io</a> · Competition Aquatics, LLC</p>
</body></html>
`;
  return { subject: `Your ownership transfer for ${team} was declined`, text, html };
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
