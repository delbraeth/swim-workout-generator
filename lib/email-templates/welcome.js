// Welcome + email-confirmation combined template. Per EMAIL_INFRA_SCOPE.md
// decision 3: one email after sign-up that welcomes + confirms email-on-file.
// No tracking pixels (decision per /security promise). No images hosted
// off-domain. Plain text + minimal HTML mirror.
//
// Vars:
//   - displayName  (string|null)   : optional; "Hi {name}" if present
//   - manualUrl    (string)        : link to /manual.html
//
// Subject + bodies kept short on purpose. Tone matches the rest of the
// app's voice: honest, solo-operator, conversational.

export default function welcome({ displayName, manualUrl }) {
  const greeting = displayName ? `Hi ${displayName} —` : "Hi —";
  const manual = manualUrl || "https://setforge.io/manual.html";

  const text =
`${greeting}

Welcome to SetForge. Your account is set up and this email confirms it's the one we have on file.

A few quick things:

· You're on the free tier, which stays free forever for swimmers. It's written into our Terms, not just a marketing line.
· The manual is the fastest way to learn what SetForge can do: ${manual}
· One person answers the email here. Reply to this message or write to hello@setforge.io anytime.
· Discord community for coaches and adult swimmers (13+) is at https://discord.gg/N8BMxNbhf7 — feature requests, bug reports, coach-to-coach talk.

— Cap'n

(SetForge · https://setforge.io · Competition Aquatics, LLC)
`;

  // Minimal HTML — no images, no external CSS, no tracking pixels.
  const html =
`<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1f2937; max-width: 560px; margin: 0 auto; padding: 16px;">
  <p>${greeting}</p>
  <p>Welcome to SetForge. Your account is set up and this email confirms it's the one we have on file.</p>
  <p>A few quick things:</p>
  <ul style="padding-left: 20px;">
    <li>You're on the free tier, which stays <strong>free forever for swimmers</strong>. It's written into our Terms, not just a marketing line.</li>
    <li>The manual is the fastest way to learn what SetForge can do: <a href="${manual}" style="color: #2563eb;">${manual}</a></li>
    <li>One person answers the email here. Reply to this message or write to <a href="mailto:hello@setforge.io" style="color: #2563eb;">hello@setforge.io</a> anytime.</li>
    <li>Discord community for coaches and adult swimmers (13+) is at <a href="https://discord.gg/N8BMxNbhf7" style="color: #2563eb;">discord.gg/N8BMxNbhf7</a> — feature requests, bug reports, coach-to-coach talk.</li>
  </ul>
  <p>— Cap'n</p>
  <p style="color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 24px;">SetForge · <a href="https://setforge.io" style="color: #6b7280;">setforge.io</a> · Competition Aquatics, LLC</p>
</body></html>
`;

  return {
    subject: "Welcome to SetForge",
    text,
    html,
  };
}
