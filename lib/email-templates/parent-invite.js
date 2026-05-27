// Parent-invite template. Per PARENT_PORTAL_MVP_SCOPE.md §3.8.
//
// Sent when a coach invites a parent's email. The parent does NOT have
// an account yet (or does and just hasn't been linked). On clicking the
// CTA, they sign in via Apple/Google OAuth — if their verified email
// matches a pending invite, dbConsumePendingInvitesForUser links them.
//
// No magic link, no token — per [[feedback-no-password-auth]] we do not
// own any auth channel. The "join" is just "sign in with the same email
// the coach typed."
//
// Vars:
//   - swimmerName  (string)        : "Aidan" / "Lane 3 swimmer"
//   - coachName    (string|null)   : optional; "Coach Sarah" / coach's display name
//   - signInUrl    (string)        : link to https://setforge.io (parent signs in)
//
// Subject is short on purpose — looks less like spam.

export default function parentInvite({ swimmerName, coachName, signInUrl }) {
  const swimmer = swimmerName || "your swimmer";
  const coach   = coachName ? coachName : "Their coach";
  const url     = signInUrl || "https://setforge.io";

  const text =
`Hi —

${coach} added your email to ${swimmer}'s SetForge profile so you can see what they're swimming each week.

To open the parent view, sign in at:
${url}

Use the email this message was sent to — Apple or Google sign-in both work. SetForge has no separate password.

Once you're in, you'll get a weekly Sunday digest of last week's practices plus a read-only view of what's coming up. You can pause the weekly email anytime in your profile.

If you weren't expecting this, just ignore the email — nothing happens until you sign in.

— Cap'n

(SetForge · https://setforge.io · Competition Aquatics, LLC)
`;

  const html =
`<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px; margin: 0 auto; padding: 16px;">
  <p>Hi —</p>
  <p>${escapeHtml(coach)} added your email to <strong>${escapeHtml(swimmer)}</strong>'s SetForge profile so you can see what they're swimming each week.</p>
  <p style="margin: 24px 0;"><a href="${url}" style="background: #2563eb; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: 600; display: inline-block;">Open SetForge</a></p>
  <p>Use the email this message was sent to — Apple or Google sign-in both work. SetForge has no separate password.</p>
  <p>Once you're in, you'll get a weekly Sunday digest of last week's practices plus a read-only view of what's coming up. You can pause the weekly email anytime in your profile.</p>
  <p style="color: #6b7280; font-size: 14px;">If you weren't expecting this, just ignore the email — nothing happens until you sign in.</p>
  <p>— Cap'n</p>
  <p style="color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 24px;">SetForge · <a href="https://setforge.io" style="color: #6b7280;">setforge.io</a> · Competition Aquatics, LLC</p>
</body></html>
`;

  return {
    subject: `${coach} invited you to see ${swimmer}'s swim workouts`,
    text,
    html,
  };
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
