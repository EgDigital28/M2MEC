import { Resend } from "resend";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getResendFromEmail() {
  return process.env.RESEND_FROM_EMAIL ?? "M2MEC <noreply@m2mec.com>";
}

export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return null;
  }

  return new Resend(apiKey);
}

export function parseEmailRecipients(value: string): string[] {
  const emails = value
    .split(/[,;\n]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  const unique = [...new Set(emails)];

  for (const email of unique) {
    if (!EMAIL_PATTERN.test(email)) {
      throw new Error(`Invalid email address: ${email}`);
    }
  }

  return unique;
}
