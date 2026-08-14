"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/set-password?reason=recovery")}`;
    const supabase = createClient();

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo },
    );

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-4 text-sm">
          <p>
            If an account exists for{" "}
            <span className="font-semibold text-foreground">{email}</span>, we
            sent a reset link. Click it to choose a new password.
          </p>
        </div>
        <ul className="space-y-2 text-sm text-muted">
          <li>• The link expires after 24 hours.</li>
          <li>• Check spam if it doesn&apos;t arrive in a few minutes.</li>
        </ul>
        <Link
          href="/login"
          className="block w-full rounded-full bg-foreground px-4 py-3 text-center text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
          placeholder="you@company.com"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-foreground px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Sending link..." : "Send reset link"}
      </button>

      <p className="text-center text-sm text-muted">
        <Link href="/login" className="text-accent hover:underline">
          Back to log in
        </Link>
      </p>
    </form>
  );
}
