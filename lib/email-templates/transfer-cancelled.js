// Ownership-transfer "cancelled" template (OWNERSHIP_TRANSFER_SCOPE §3.7).
// Sent to the PROPOSED NEW OWNER when the original owner cancels the pending
// transfer. Nothing changed. Vars: teamName (string), signInUrl (optional).
export default function transferCancelled({ teamName, signInUrl }) {
  const team = teamName || "a team";
  const url  = signInUrl || "https://setforge.io";
  const text =
`Hi —

The ownership transfer for ${team} was cancelled by the current owner. Nothing changed — you remain an admin of the team.

${url}

— Cap'n
(SetForge · https://setforge.io · Competition Aquatics, LLC)
`;
  const html =
`<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:16px;">
  <p>Hi —</p>
  <p>The ownership transfer for <strong>${escapeHtml(team)}</strong> was cancelled by the current owner. Nothing changed — you remain an admin of the team.</p>
  <p style="margin:24px 0;"><a href="${url}" style="background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;display:inline-block;">Open SetForge</a></p>
  <p>— Cap'n</p>
  <p style="color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:24px;">SetForge · <a href="https://setforge.io" style="color:#6b7280;">setforge.io</a> · Competition Aquatics, LLC</p>
</body></html>
`;
  return { subject: `The ownership transfer for ${team} was cancelled`, text, html };
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
