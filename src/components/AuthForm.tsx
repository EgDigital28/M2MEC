"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasMinimumTier, isUserTier } from "@/lib/tiers";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nextPath = searchParams.get("next");
  const safeNext =
    nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
  const passwordUpdated = searchParams.get("message") === "password_updated";
  const authError = searchParams.get("error");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (safeNext === "/") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tier")
        .single();

      if (profile?.tier && isUserTier(profile.tier) && hasMinimumTier(profile.tier, "employee")) {
        router.push("/team");
        router.refresh();
        return;
      }
    }

    router.push(safeNext);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {passwordUpdated && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Password updated. Sign in with your new password.
        </p>
      )}

      {authError === "auth_callback_failed" && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          That link expired or is invalid. Request a new reset link below.
        </p>
      )}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
          placeholder="you@company.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
          placeholder="Your password"
        />
      </div>

      <p className="text-right text-sm">
        <Link href="/forgot-password" className="text-accent hover:underline">
          Forgot password?
        </Link>
      </p>

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
        {loading ? "Signing in..." : "Sign in"}
      </button>

      <p className="text-center text-sm text-muted">
        Access is invite-only.{" "}
        <Link href="/#contact" className="text-accent hover:underline">
          Join the waitlist
        </Link>{" "}
        for early access.
      </p>
    </form>
  );
}
