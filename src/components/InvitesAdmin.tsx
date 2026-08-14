"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { InviteActivityRow } from "@/lib/invites/types";
import { TIER_LABELS, type UserTier } from "@/lib/tiers";

type InviteFilter = "all" | "pending" | "registered" | "suspended";

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function inviteState(row: InviteActivityRow) {
  if (row.suspended_at) {
    return "Suspended";
  }

  if (!row.registered_at) {
    return "Invite sent";
  }

  return "Registered";
}

function inviteStateClass(row: InviteActivityRow) {
  if (row.suspended_at) {
    return "border-red-500/30 text-red-300";
  }

  if (!row.registered_at) {
    return "border-amber-500/30 text-amber-200";
  }

  return "border-emerald-500/30 text-emerald-300";
}

export function InvitesAdmin() {
  const [invites, setInvites] = useState<InviteActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [filter, setFilter] = useState<InviteFilter>("all");
  const [migrationRequired, setMigrationRequired] = useState(false);

  const loadInvites = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMigrationRequired(false);

    try {
      const response = await fetch("/api/invites");
      const data = (await response.json()) as {
        invites?: InviteActivityRow[];
        error?: string;
        migrationRequired?: boolean;
      };

      if (!response.ok) {
        setError(data.error ?? "Could not load invite activity.");
        setLoading(false);
        return;
      }

      setInvites(data.invites ?? []);
      setMigrationRequired(Boolean(data.migrationRequired));
    } catch {
      setError("Network error while loading invite activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const filteredInvites = useMemo(() => {
    return invites.filter((row) => {
      if (filter === "pending") {
        return !row.registered_at && !row.suspended_at;
      }

      if (filter === "registered") {
        return Boolean(row.registered_at) && !row.suspended_at;
      }

      if (filter === "suspended") {
        return Boolean(row.suspended_at);
      }

      return true;
    });
  }, [filter, invites]);

  async function resendInvite(row: InviteActivityRow) {
    const confirmed = window.confirm(`Resend ${TIER_LABELS[row.tier]} invite to ${row.email}?`);

    if (!confirmed) {
      return;
    }

    setActionId(row.profile_id);
    setError(null);

    try {
      const response = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: row.email, tier: row.tier }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not resend invite.");
        setActionId(null);
        return;
      }

      await loadInvites();
    } catch {
      setError("Network error while resending invite.");
    } finally {
      setActionId(null);
    }
  }

  const filters: { value: InviteFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "registered", label: "Registered" },
    { value: "suspended", label: "Suspended" },
  ];

  return (
    <div className="space-y-4">
      {migrationRequired && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Run <code className="text-foreground">009_admin_waitlist_invites.sql</code> in Supabase
          for full invite history tracking.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {filters.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === option.value
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border text-muted hover:border-accent/30 hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-2xl border border-border">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-elevated text-left text-muted">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Invites sent</th>
                <th className="px-4 py-3 font-medium">Last invite</th>
                <th className="px-4 py-3 font-medium">Registered</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted">
                    Loading invite activity...
                  </td>
                </tr>
              ) : filteredInvites.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted">
                    No invites match this filter.
                  </td>
                </tr>
              ) : (
                filteredInvites.map((row) => {
                  const isBusy = actionId === row.profile_id;
                  const canResend = !row.registered_at && !row.suspended_at;

                  return (
                    <tr key={row.profile_id} className="border-b border-border/60">
                      <td className="px-4 py-3 font-medium">{row.email}</td>
                      <td className="px-4 py-3 text-muted">
                        {row.display_name?.trim() || "—"}
                      </td>
                      <td className="px-4 py-3">{TIER_LABELS[row.tier as UserTier]}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] ${inviteStateClass(row)}`}
                        >
                          {inviteState(row)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">{row.invite_count}</td>
                      <td className="px-4 py-3 text-muted">
                        {formatDate(row.last_invited_at)}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {row.registered_at ? formatDate(row.registered_at) : "Invite sent"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={isBusy || !canResend}
                          onClick={() => resendInvite(row)}
                          className="rounded-full border border-border px-3 py-1.5 text-[11px] font-medium transition-colors hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isBusy ? "Working..." : "Resend"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
