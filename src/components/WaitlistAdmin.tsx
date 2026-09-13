"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { UserTier } from "@/lib/tiers";
import {
  WAITLIST_STATUS_LABELS,
  WAITLIST_STATUSES,
  type WaitlistStatus,
  type WaitlistSubmission,
} from "@/lib/waitlist/types";

const INVITE_TIER_OPTIONS: { value: UserTier; label: string }[] = [
  { value: "a", label: "Tier A" },
  { value: "b", label: "Tier B" },
  { value: "investor", label: "Investor" },
  { value: "employee", label: "Employee" },
];

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

function statusBadgeClass(status: WaitlistStatus) {
  switch (status) {
    case "converted":
      return "border-emerald-500/30 text-emerald-300";
    case "invited":
      return "border-accent/30 text-accent";
    case "welcomed":
      return "border-amber-500/30 text-amber-200";
    default:
      return "border-border text-muted";
  }
}

export function WaitlistAdmin() {
  const [submissions, setSubmissions] = useState<WaitlistSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [inviteTierById, setInviteTierById] = useState<Record<string, UserTier>>({});

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/waitlist/admin");
      const data = (await response.json()) as {
        submissions?: WaitlistSubmission[];
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Could not load waitlist.");
        setLoading(false);
        return;
      }

      setSubmissions(data.submissions ?? []);
    } catch {
      setError("Network error while loading waitlist.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  async function updateStatus(submission: WaitlistSubmission, status: WaitlistStatus) {
    setActionId(submission.id);
    setError(null);

    try {
      const response = await fetch(`/api/waitlist/${submission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = (await response.json()) as {
        submission?: WaitlistSubmission;
        error?: string;
      };

      if (!response.ok) {
        setError(data.error ?? "Could not update status.");
        setActionId(null);
        return;
      }

      if (data.submission) {
        setSubmissions((current) =>
          current.map((row) => (row.id === data.submission!.id ? data.submission! : row)),
        );
      }
    } catch {
      setError("Network error while updating status.");
    } finally {
      setActionId(null);
    }
  }

  async function sendInvite(submission: WaitlistSubmission) {
    const tier = inviteTierById[submission.id] ?? "b";

    setActionId(submission.id);
    setError(null);

    try {
      const response = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: submission.email, tier }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not send invite.");
        setActionId(null);
        return;
      }

      await loadSubmissions();
    } catch {
      setError("Network error while sending invite.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-border">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-elevated text-left text-muted">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Message</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium">Welcome sent</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    Loading waitlist...
                  </td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    No waitlist submissions yet.
                  </td>
                </tr>
              ) : (
                submissions.map((submission) => {
                  const isBusy = actionId === submission.id;
                  const canInvite = submission.status !== "converted";

                  return (
                    <tr key={submission.id} className="border-b border-border/60 align-top">
                      <td className="px-4 py-3 font-medium">{submission.name}</td>
                      <td className="px-4 py-3">{submission.email}</td>
                      <td className="max-w-[220px] px-4 py-3 text-muted">
                        <p className="line-clamp-3">{submission.message}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] ${statusBadgeClass(submission.status)}`}
                        >
                          {WAITLIST_STATUS_LABELS[submission.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatDate(submission.created_at)}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {formatDate(submission.welcome_email_sent_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-end gap-2">
                          <select
                            value={submission.status}
                            disabled={isBusy}
                            onChange={(event) =>
                              updateStatus(submission, event.target.value as WaitlistStatus)
                            }
                            className="rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] outline-none focus:border-accent"
                          >
                            {WAITLIST_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {WAITLIST_STATUS_LABELS[status]}
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center gap-2">
                            <select
                              value={inviteTierById[submission.id] ?? "b"}
                              disabled={isBusy}
                              onChange={(event) =>
                                setInviteTierById((current) => ({
                                  ...current,
                                  [submission.id]: event.target.value as UserTier,
                                }))
                              }
                              className="rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] outline-none focus:border-accent"
                            >
                              {INVITE_TIER_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={isBusy || !canInvite}
                              onClick={() => sendInvite(submission)}
                              className="rounded-full border border-border px-3 py-1.5 text-[11px] font-medium transition-colors hover:border-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isBusy ? "Working..." : "Invite"}
                            </button>
                          </div>

                          <Link
                            href={`/team/invite?email=${encodeURIComponent(submission.email)}&tier=${inviteTierById[submission.id] ?? "b"}`}
                            className="text-[11px] text-accent hover:underline"
                          >
                            Open invite form
                          </Link>
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
