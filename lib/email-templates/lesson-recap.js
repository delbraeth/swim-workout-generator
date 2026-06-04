// Lesson tier (Phase 5) — parent recap export. A coach/instructor sends a
// branded one-pager of a lesson workout to the swimmer's parent/guardian.
//
// Recipient is the GUARDIAN's email (an adult), passed as toEmail — so the
// minor-bypass (which protects emailing minors directly) does not apply.
//
// Vars:
//   - swimmerName  (string)            : the swimmer the lesson was for
//   - coachName    (string|null)       : sending coach's display name
//   - note         (string|null)       : optional free-text note from the coach
//   - workout      (object)            : { typeLabel, totalYards, estimatedMin,
//                                          blocks: [{ name, totalYards,
//                                            sets: [{ reps, dist, desc, interval }] }] }

export default function lessonRecap({ swimmerName, coachName, note, workout }) {
  const sw   = swimmerName || "your swimmer";
  const w    = workout || {};
  const blocks = Array.isArray(w.blocks) ? w.blocks : [];
  const yards  = (w.totalYards || 0).toLocaleString();
  const mins   = w.estimatedMin ? `${w.estimatedMin} min` : null;
  const typeLabel = w.typeLabel || "Lesson";
  const fromLine  = coachName ? `${coachName} put together` : "Here's";

  const metaBits = [yards ? `${yards} ${w.unit || "yds"}` : null, mins].filter(Boolean).join(" · ");

  const textBlocks = blocks.map(b => renderTextBlock(b)).join("\n");
  const htmlBlocks = blocks.map(b => renderHtmlBlock(b)).join("\n");
  const noteText = note ? `\nA note from coach:\n"${note}"\n` : "";
  const noteHtml = note
    ? `<div style="background:#eff6ff;border-left:3px solid #2563eb;padding:10px 14px;margin:16px 0;color:#1e3a5f;font-style:italic;">${escapeHtml(note)}</div>`
    : "";

  const text =
`Hi —

${fromLine} a swim lesson recap for ${sw}.

${typeLabel}${metaBits ? ` — ${metaBits}` : ""}
${noteText}
${textBlocks || "(No sets recorded.)"}

— ${coachName || "Your coach"} · via SetForge

(SetForge · https://setforge.io · Competition Aquatics, LLC)
`;

  const html =
`<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.55; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 16px;">
  <p style="margin:0 0 4px;">Hi —</p>
  <p style="color:#6b7280;margin:0 0 16px;">${escapeHtml(fromLine)} a swim lesson recap for <strong>${escapeHtml(sw)}</strong>.</p>
  <div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;background:#f9fafb;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-bottom:8px;">
      <span style="font-size:16px;font-weight:700;color:#111827;">${escapeHtml(typeLabel)}</span>
      ${metaBits ? `<span style="font-size:13px;color:#6b7280;">${escapeHtml(metaBits)}</span>` : ""}
    </div>
    ${noteHtml}
    ${htmlBlocks || `<p style="color:#6b7280;font-style:italic;">(No sets recorded.)</p>`}
  </div>
  <p style="color:#6b7280;font-size:13px;margin-top:16px;">— ${escapeHtml(coachName || "Your coach")} · via SetForge</p>
  <p style="color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:20px;">SetForge · <a href="https://setforge.io" style="color:#6b7280;">setforge.io</a> · Competition Aquatics, LLC</p>
</body></html>
`;

  return {
    subject: `Swim lesson recap — ${sw}`,
    text,
    html,
  };
}

function renderSetLine(s) {
  const reps = s.reps ? `${s.reps}×` : "";
  const dist = s.dist != null ? s.dist : "";
  const desc = s.desc ? ` ${s.desc}` : "";
  const intv = s.interval ? ` @ ${s.interval}` : "";
  return `${reps}${dist}${desc}${intv}`.trim();
}

function renderTextBlock(b) {
  const name  = b.name || "Section";
  const yards = b.totalYards ? ` (${b.totalYards})` : "";
  const sets  = Array.isArray(b.sets) ? b.sets : [];
  const lines = sets.map(s => `   - ${renderSetLine(s)}`).join("\n");
  return `${name}${yards}\n${lines}`;
}

function renderHtmlBlock(b) {
  const name  = b.name || "Section";
  const yards = b.totalYards ? ` <span style="color:#6b7280;font-weight:400;">(${b.totalYards})</span>` : "";
  const sets  = Array.isArray(b.sets) ? b.sets : [];
  const items = sets.map(s => `<li style="margin:2px 0;">${escapeHtml(renderSetLine(s))}</li>`).join("");
  return `
  <div style="margin:10px 0;">
    <div style="font-weight:700;color:#111827;font-size:14px;">${escapeHtml(name)}${yards}</div>
    <ul style="margin:4px 0 0;padding-left:20px;color:#374151;font-size:13px;">${items}</ul>
  </div>`;
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
