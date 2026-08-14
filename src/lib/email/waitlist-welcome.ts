type WaitlistWelcomeEmailParams = {
  name: string;
};

export function waitlistWelcomeSubject() {
  return "You're on the M2MEC early access list";
}

export function waitlistWelcomeHtml({ name }: WaitlistWelcomeEmailParams) {
  const firstName = name.trim().split(/\s+/)[0] || "there";

  return `
    <p>Hi ${escapeHtml(firstName)},</p>
    <p>
      Thanks for raising your hand — you're on the M2MEC early access list.
    </p>
    <p>
      We're building a sports intelligence platform powered by machine learning:
      data services, predictive analytics, a consolidated sportsbook hub, and an
      AI assistant to tie it all together.
    </p>
    <p><strong>What happens next</strong></p>
    <ul>
      <li>We're rolling out access in small waves while we build.</li>
      <li>You'll hear from us at this address when your spot opens up.</li>
      <li>No account is created yet — this is just the waitlist.</li>
    </ul>
    <p>
      Questions in the meantime? Reply here or write us at
      <a href="mailto:hello@m2mec.com">hello@m2mec.com</a>.
    </p>
    <p>— The M2MEC team</p>
  `.trim();
}

export function waitlistWelcomeText({ name }: WaitlistWelcomeEmailParams) {
  const firstName = name.trim().split(/\s+/)[0] || "there";

  return `
Hi ${firstName},

Thanks for raising your hand — you're on the M2MEC early access list.

We're building a sports intelligence platform powered by machine learning: data services, predictive analytics, a consolidated sportsbook hub, and an AI assistant to tie it all together.

What happens next:
- We're rolling out access in small waves while we build.
- You'll hear from us at this address when your spot opens up.
- No account is created yet — this is just the waitlist.

Questions? Reply here or email hello@m2mec.com.

— The M2MEC team
  `.trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
