"use client";

import { useCallback, useEffect, useState } from "react";
import { TrashIcon, tableActionButtonClass } from "@/components/TableActionIcons";
import type { ManagedUser } from "@/lib/users/types";
import { TIER_LABELS, type UserTier } from "@/lib/tiers";

type UsersAdminProps = {
  currentUserId: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function UsersAdmin({ currentUserId }: UsersAdminProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [migrationRequired, setMigrationRequired] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMigrationRequired(false);

    try {
      const response = await fetch("/api/users");
      const raw = await response.text();

      let data: { users?: ManagedUser[]; error?: string; migrationRequired?: boolean };

      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        setError(`Server error (${response.status}). Check Vercel logs.`);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        setError(data.error ?? "Could not load users.");
        setLoading(false);
        return;
      }

      setUsers(data.users ?? []);
      setMigrationRequired(Boolean(data.migrationRequired));
    } catch {
      setError("Network error while loading users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  async function updateSuspension(user: ManagedUser, action: "suspend" | "unsuspend") {
    const verb = action === "suspend" ? "suspend" : "unsuspend";
    const confirmed = window.confirm(
      action === "suspend"
        ? `Suspend ${user.email}? They will be signed out and cannot be invited again until unsuspended.`
        : `Unsuspend ${user.email}? They can sign in and be invited again.`,
    );

    if (!confirmed) {
      return;
    }

    setActionUserId(user.id);
    setError(null);

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? `Could not ${verb} user.`);
        setActionUserId(null);
        return;
      }

      await loadUsers();
    } catch {
      setError(`Network error while trying to ${verb} user.`);
    } finally {
      setActionUserId(null);
    }
  }

  async function deleteUser(user: ManagedUser) {
    const confirmed = window.confirm(
      `Delete ${user.email}? This removes their account permanently. They can be invited again later unless you suspend them first.`,
    );

    if (!confirmed) {
      return;
    }

    setActionUserId(user.id);
    setError(null);

    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not delete user.");
        setActionUserId(null);
        return;
      }

      await loadUsers();
    } catch {
      setError("Network error while deleting user.");
    } finally {
      setActionUserId(null);
    }
  }

  return (
    <div className="space-y-4">
      {migrationRequired && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Run pending Supabase migrations (
          <code className="text-foreground">005_user_suspensions.sql</code>,{" "}
          <code className="text-foreground">008_profile_registration.sql</code>) to enable
          full user management.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-border">
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-elevated text-left text-muted">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Tier</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isSelf = user.id === currentUserId;
                  const isSuspended = Boolean(user.suspended_at);
                  const isPendingInvite = !user.registered_at;
                  const isBusy = actionUserId === user.id;

                  return (
                    <tr key={user.id} className="border-b border-border/60">
                      <td className="px-4 py-3">
                        <p className="font-medium">{user.email}</p>
                        {isSelf ? (
                          <p className="mt-0.5 text-accent">This is you</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {user.display_name?.trim() || "—"}
                      </td>
                      <td className="px-4 py-3">{TIER_LABELS[user.tier as UserTier]}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] ${
                            isSuspended
                              ? "border-red-500/30 text-red-300"
                              : "border-emerald-500/30 text-emerald-300"
                          }`}
                        >
                          {isSuspended ? "Suspended" : "Active"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {isPendingInvite ? (
                          <span className="text-amber-200">Invite sent</span>
                        ) : (
                          formatDate(user.registered_at!)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {!isSelf && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                updateSuspension(user, isSuspended ? "unsuspend" : "suspend")
                              }
                              className="rounded-full border border-border px-3 py-1.5 text-[11px] font-medium transition-colors hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isBusy
                                ? "Working..."
                                : isSuspended
                                  ? "Unsuspend"
                                  : "Suspend"}
                            </button>
                          )}
                          {!isSelf && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => deleteUser(user)}
                              aria-label={`Delete ${user.email}`}
                              title="Delete"
                              className={tableActionButtonClass.delete}
                            >
                              <TrashIcon />
                            </button>
                          )}
                        </div>
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
