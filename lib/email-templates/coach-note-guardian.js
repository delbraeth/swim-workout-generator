// MAAP/SafeSport (Phase 5 #3) — parent-CC on minor-directed coach notes.
// When a coach writes a note about a swimmer who is a minor, the swimmer's
// guardian gets a copy, so coach↔minor communication is transparent to a
// parent (MAAP guidance). Recipient is the GUARDIAN's email (an adult), passed
// as toEmail — the minor-bypass that protects emailing minors doesn't apply.
//
// Vars:
//   - swimmerName (string)       : the swimmer the note is about
//   - coachName   (string|null)  : the authoring coach's display name
//   - note        (string)       : the note body

export default function coachNoteGuardian({ swimmerName, coachName, note }) {
  const sw = swimmerName || "your swimmer";
  const coach = coachName || "Your swimmer's coach";
  const body = note || "";

  const text =
`Hi —

${coach} left a coaching note about ${sw}. You're receiving a copy because ${sw} is under 18 (MAAP / SafeSport transparency).

"${body}"

— ${coach} · via SetForge

You're receiving this as ${sw}'s listed guardian. (SetForge · https://setforge.io · Competition Aquatics, LLC)
`;

  const html =
`<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.55; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 16px;">
  <p style="margin:0 0 4px;">Hi —</p>
  <p style="color:#6b7280;margin:0 0 16px;"><strong>${escapeHtml(coach)}</strong> left a coaching note about <strong>${escapeHtml(sw)}</strong>. You're receiving a copy because ${escapeHtml(sw)} is under 18 (MAAP / SafeSport transparency).</p>
  <div style="background:#eff6ff;border-left:3px solid #2563eb;padding:12px 16px;margin:16px 0;color:#1e3a5f;">${escapeHtml(body).replace(/\n/g, "<br>")}</div>
  <p style="color:#6b7280;font-size:13px;margin-top:16px;">— ${escapeHtml(coach)} · via SetForge</p>
  <p style="color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:20px;">You're receiving this as ${escapeHtml(sw)}'s listed guardian. SetForge · <a href="https://setforge.io" style="color:#6b7280;">setforge.io</a> · Competition Aquatics, LLC</p>
</body></html>
`;

  return { subject: `Coaching note about ${sw}`, text, html };
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
