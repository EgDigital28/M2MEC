/**
 * Site access is currently restricted to a single administrator. This is a
 * deliberate lockdown, not a tier rule: a correctly provisioned investor or
 * employee still cannot sign in while their address is absent here.
 *
 * Server-only — the list is never shipped to the browser. Set
 * SITE_ALLOWED_EMAILS to a comma-separated list to widen or reopen access
 * without a code change.
 */

const DEFAULT_ALLOWED_EMAILS = ["eli.goshert@gmail.com"];

export function allowedLoginEmails() {
  const configured = process.env.SITE_ALLOWED_EMAILS;

  if (!configured?.trim()) {
    return DEFAULT_ALLOWED_EMAILS;
  }

  return configured
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  return allowedLoginEmails().includes(email.trim().toLowerCase());
}
