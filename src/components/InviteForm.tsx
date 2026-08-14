"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { UserTier } from "@/lib/tiers";

type InviteFormProps = {
  allowEmployeeTier?: boolean;
};

const TIER_A_OPTION = { value: "a" as const, label: "Tier A — full product access" };
const TIER_B_OPTION = { value: "b" as const, label: "Tier B — limited access" };
const EMPLOYEE_TIER_OPTION = {
  value: "employee" as const,
  label: "Employee — internal team",
};
const INVESTOR_TIER_OPTION = {
  value: "investor" as const,
  label: "Investor — investor access",
};

export function InviteForm({ allowEmployeeTier = false }: InviteFormProps) {
  const router = useRouter();
  const inviteTiers = allowEmployeeTier
    ? [TIER_A_OPTION, TIER_B_OPTION, EMPLOYEE_TIER_OPTION, INVESTOR_TIER_OPTION]
    : [TIER_A_OPTION, TIER_B_OPTION, INVESTOR_TIER_OPTION];
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState<UserTier>("a");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, tier }),
      });

      const data = (await response.json()) as {
        error?: string;
        email?: string;
        tierLabel?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Could not send invite.");
        setLoading(false);
        return;
      }

      setSuccess(`Invite sent to ${data.email ?? email}${data.tierLabel ? ` (${data.tierLabel})` : ""}.`);
      setEmail("");
      setTier("a");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="colleague@example.com"
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
        />
      </div>

      <div>
        <label htmlFor="tier" className="mb-1.5 block text-sm font-medium">
          Access tier
        </label>
        <select
          id="tier"
          value={tier}
          onChange={(event) => setTier(event.target.value as UserTier)}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent"
        >
          {inviteTiers.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {success && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-foreground px-4 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Sending invite..." : "Send invite"}
      </button>

      <p className="text-center text-xs text-muted">
        Invites come from noreply@m2mec.com. They&apos;ll set a password from the email link,
        then sign in.
      </p>
    </form>
  );
}
