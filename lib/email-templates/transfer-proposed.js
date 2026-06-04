// Ownership-transfer "proposed" template (OWNERSHIP_TRANSFER_SCOPE §3.7).
// Sent to the PROPOSED NEW OWNER when an owner initiates a hand-off.
// Vars: teamName (string), signInUrl (string, optional).
export default function transferProposed({ teamName, signInUrl }) {
  const team = teamName || "a team";
  const url  = signInUrl || "https://setforge.io";
  const text =
`Hi —

You've been proposed as the new owner of ${team} on SetForge.

Open SetForge to Accept now or Decline:
${url}

If you do nothing, the transfer completes automatically after 30 days. Until then the current owner can cancel it.

— Cap'n
(SetForge · https://setforge.io · Competition Aquatics, LLC)
`;
  const html =
`<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:16px;">
  <p>Hi —</p>
  <p>You've been proposed as the <strong>new owner of ${escapeHtml(team)}</strong> on SetForge.</p>
  <p style="margin:24px 0;"><a href="${url}" style="background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;display:inline-block;">Open SetForge</a></p>
  <p>Accept now or Decline from the team's Settings. If you do nothing, the transfer completes automatically after 30 days; the current owner can cancel it before then.</p>
  <p>— Cap'n</p>
  <p style="color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:24px;">SetForge · <a href="https://setforge.io" style="color:#6b7280;">setforge.io</a> · Competition Aquatics, LLC</p>
</body></html>
`;
  return { subject: `You've been proposed as the new owner of ${team}`, text, html };
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
