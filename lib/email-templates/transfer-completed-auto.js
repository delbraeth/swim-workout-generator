// Ownership-transfer "auto-completed" template (OWNERSHIP_TRANSFER_SCOPE §3.7).
// Sent to BOTH parties after the 30-day cooldown elapses with no action and the
// cron auto-completes the transfer. `role` distinguishes the copy.
// Vars: teamName (string), role ('new_owner'|'former_owner'), signInUrl (optional).
export default function transferCompletedAuto({ teamName, role, signInUrl }) {
  const team = teamName || "the team";
  const url  = signInUrl || "https://setforge.io";
  const isNew = role === "new_owner";
  const line = isNew
    ? `The 30-day window elapsed, so you're now the owner of ${team}. The previous owner is now an admin, and their team-shared and public workout sets moved to you.`
    : `The 30-day window elapsed, so ownership of ${team} transferred to the coach you proposed. You're now an admin, and your team-shared and public workout sets moved to the new owner.`;
  const text =
`Hi —

${line}

${url}

— Cap'n
(SetForge · https://setforge.io · Competition Aquatics, LLC)
`;
  const html =
`<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:16px;">
  <p>Hi —</p>
  <p>${escapeHtml(line)}</p>
  <p style="margin:24px 0;"><a href="${url}" style="background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;display:inline-block;">Open SetForge</a></p>
  <p>— Cap'n</p>
  <p style="color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:24px;">SetForge · <a href="https://setforge.io" style="color:#6b7280;">setforge.io</a> · Competition Aquatics, LLC</p>
</body></html>
`;
  return { subject: `Ownership of ${team} has transferred`, text, html };
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
