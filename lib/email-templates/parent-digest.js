// Parent weekly digest. Per PARENT_PORTAL_MVP_SCOPE.md §3.9.
//
// Sent Sunday 18:00 US-Eastern by the email worker's cron tick. One
// email per parent, with a block per swimmer they guard. Subject is
// stable so threading in Gmail/Apple Mail groups week-over-week.
//
// Vars:
//   - parentDisplayName  (string|null)
//   - weekStart          (string YYYY-MM-DD)  : Monday of the week just ended
//   - swimmers           (array)              : [{ swimmer: {display_name}, assigned, done, yardage, upcoming, attendance }, ...]
//
// "Attendance" only present for full-account swimmers. Managed swimmers
// don't have scheduled_workouts of their own — their assigned/done is
// the signal. The renderer suppresses the attendance line when total=0.

export default function parentDigest({ parentDisplayName, weekStart, swimmers }) {
  const greeting = parentDisplayName ? `Hi ${parentDisplayName} —` : "Hi —";
  const wk = formatWeekRange(weekStart);
  const sw = Array.isArray(swimmers) ? swimmers : [];

  const textBlocks = sw.map(b => renderTextBlock(b)).join("\n");
  const htmlBlocks = sw.map(b => renderHtmlBlock(b)).join("\n");

  const text =
`${greeting}

Here's the SetForge weekly digest for ${wk}.

${textBlocks || "(No swimmers linked yet — once a coach finishes the invite, this email will start showing their week.)"}

Open the parent view: https://setforge.io

You can pause this weekly email anytime from your profile (☰ → Profile → Pause weekly digest).

— Cap'n

(SetForge · https://setforge.io · Competition Aquatics, LLC)
`;

  const html =
`<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.55; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 16px;">
  <p>${greeting}</p>
  <p style="color: #6b7280; margin-bottom: 16px;">Here's the SetForge weekly digest for <strong>${escapeHtml(wk)}</strong>.</p>
  ${htmlBlocks || `<p style="color: #6b7280; font-style: italic;">(No swimmers linked yet — once a coach finishes the invite, this email will start showing their week.)</p>`}
  <p style="margin-top: 24px;"><a href="https://setforge.io" style="background: #2563eb; color: #fff; text-decoration: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; display: inline-block;">Open parent view</a></p>
  <p style="color: #6b7280; font-size: 13px;">You can pause this weekly email anytime from your profile (☰ → Profile → Pause weekly digest).</p>
  <p>— Cap'n</p>
  <p style="color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 24px;">SetForge · <a href="https://setforge.io" style="color: #6b7280;">setforge.io</a> · Competition Aquatics, LLC</p>
</body></html>
`;

  return {
    subject: `SetForge weekly digest — ${wk}`,
    text,
    html,
  };
}

function renderTextBlock(b) {
  const name = b.swimmer?.display_name || "Swimmer";
  const yards = (b.yardage || 0).toLocaleString();
  const att = (b.attendance && b.attendance.total > 0)
    ? `\n  · Attendance: ${b.attendance.done} of ${b.attendance.total} practices`
    : "";
  return `${name}
  · ${b.done || 0} of ${b.assigned || 0} workouts done · ${yards} yards${att}
  · ${b.upcoming || 0} workout${b.upcoming === 1 ? "" : "s"} scheduled next week
`;
}

function renderHtmlBlock(b) {
  const name  = b.swimmer?.display_name || "Swimmer";
  const yards = (b.yardage || 0).toLocaleString();
  const attLine = (b.attendance && b.attendance.total > 0)
    ? `<li>Attendance: <strong>${b.attendance.done}</strong> of ${b.attendance.total} practices</li>`
    : "";
  return `
  <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin: 12px 0; background: #f9fafb;">
    <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #111827;">${escapeHtml(name)}</h3>
    <ul style="margin: 0; padding-left: 20px; color: #374151;">
      <li><strong>${b.done || 0}</strong> of ${b.assigned || 0} workouts done · <strong>${yards}</strong> yards</li>
      ${attLine}
      <li>${b.upcoming || 0} workout${b.upcoming === 1 ? "" : "s"} scheduled next week</li>
    </ul>
  </div>`;
}

// Format "Mon Mar 17 – Sun Mar 23" from a Monday YYYY-MM-DD.
function formatWeekRange(weekStart) {
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return "this week";
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (d) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
