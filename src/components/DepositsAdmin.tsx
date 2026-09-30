"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { formatCurrencyWhole } from "@/lib/bets/calculations";
import {
  DEPOSIT_KIND_LABELS,
  DEPOSIT_METHODS,
  DEPOSIT_METHOD_LABELS,
  depositMethodLabel,
  depositPersonLabel,
  formatDepositDate,
  sumDeposits,
  type CapitalDeposit,
  type DepositKind,
} from "@/lib/financials/deposits";
import type { EquityStake } from "@/lib/financials/types";
import type { WageringStakeGroup } from "@/lib/financials/wagering";
import type { ManagedUser } from "@/lib/users/types";

const emptyForm = (kind: DepositKind) => ({
  profile_id: "",
  kind,
  method: "wire" as string,
  group_id: "",
  deposited_on: "",
  amount: "",
  description: "",
});

type FormState = ReturnType<typeof emptyForm>;

function personLabel(user: Pick<ManagedUser, "display_name" | "email">) {
  return user.display_name?.trim() ? `${user.display_name} (${user.email})` : user.email;
}

const field =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent";
const labelClass = "text-[10px] font-semibold uppercase tracking-widest text-muted";

type OutstandingRow = { key: string; label: string; due: number };

type SectionProps = {
  kind: DepositKind;
  blurb: string;
  outstanding?: OutstandingRow[];
  groups: WageringStakeGroup[];
  users: ManagedUser[];
  rows: CapitalDeposit[];
  busy: boolean;
  onCreate: (form: FormState) => Promise<boolean>;
  onSave: (id: string, form: FormState) => Promise<boolean>;
  onDelete: (row: CapitalDeposit) => Promise<void>;
};

function DepositSection({
  kind,
  blurb,
  outstanding,
  groups,
  users,
  rows,
  busy,
  onCreate,
  onSave,
  onDelete,
}: SectionProps) {
  const [form, setForm] = useState<FormState>(emptyForm(kind));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm(kind));

  const total = useMemo(() => sumDeposits(rows), [rows]);

  // With one wagering group the choice is not worth asking about, so it is
  // filled in and only surfaced once a second group exists.
  const soleGroupId = groups.length === 1 ? groups[0].id : "";
  const groupId = kind === "betting" ? form.group_id || soleGroupId : "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await onCreate({ ...form, group_id: groupId })) {
      setForm(emptyForm(kind));
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{DEPOSIT_KIND_LABELS[kind]}</h2>
          <p className="mt-1 text-sm text-muted">{blurb}</p>
        </div>
        <p className="text-sm tabular-nums text-muted">
          Total <span className="font-semibold text-foreground">{formatCurrencyWhole(total)}</span>
        </p>
      </div>

      {outstanding && outstanding.length > 0 ? (
        <div className="rounded-xl border border-border p-3">
          <p className={labelClass}>Outstanding balance</p>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {outstanding.map((row) => (
              <li key={row.key} className="tabular-nums">
                <span className="text-muted">{row.label}</span>{" "}
                <span className={row.due > 0 ? "text-amber-300" : "text-emerald-300"}>
                  {formatCurrencyWhole(row.due)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <label>
          <span className={labelClass}>Person</span>
          <select
            required
            value={form.profile_id}
            onChange={(event) => setForm({ ...form, profile_id: event.target.value })}
            className={`mt-2 ${field}`}
          >
            <option value="">Select…</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {personLabel(user)}
              </option>
            ))}
          </select>
        </label>
        {kind === "betting" && groups.length > 1 ? (
          <label>
            <span className={labelClass}>Group</span>
            <select
              required
              value={form.group_id}
              onChange={(event) => setForm({ ...form, group_id: event.target.value })}
              className={`mt-2 ${field}`}
            >
              <option value="">Select…</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          <span className={labelClass}>Date</span>
          <input
            required
            type="date"
            value={form.deposited_on}
            onChange={(event) => setForm({ ...form, deposited_on: event.target.value })}
            className={`mt-2 ${field}`}
          />
        </label>
        <label>
          <span className={labelClass}>Method</span>
          <select
            required
            value={form.method}
            onChange={(event) => setForm({ ...form, method: event.target.value })}
            className={`mt-2 ${field}`}
          >
            {DEPOSIT_METHODS.map((method) => (
              <option key={method} value={method}>
                {DEPOSIT_METHOD_LABELS[method]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelClass}>Amount</span>
          <input
            required
            inputMode="decimal"
            placeholder="100000"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            className={`mt-2 ${field}`}
          />
        </label>
        <label>
          <span className={labelClass}>Description</span>
          <input
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Optional"
            className={`mt-2 ${field}`}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-auto rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
        >
          Add deposit
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-3 py-2 font-medium">Person</th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Method</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted">
                  No deposits recorded.
                </td>
              </tr>
            ) : (
              rows.map((row) =>
                editingId === row.id ? (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="px-3 py-2">
                      <select
                        value={editForm.profile_id}
                        onChange={(event) =>
                          setEditForm({ ...editForm, profile_id: event.target.value })
                        }
                        className={field}
                      >
                        {users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {personLabel(user)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={editForm.deposited_on}
                        onChange={(event) =>
                          setEditForm({ ...editForm, deposited_on: event.target.value })
                        }
                        className={field}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={editForm.method}
                        onChange={(event) =>
                          setEditForm({ ...editForm, method: event.target.value })
                        }
                        className={field}
                      >
                        {DEPOSIT_METHODS.map((method) => (
                          <option key={method} value={method}>
                            {DEPOSIT_METHOD_LABELS[method]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        inputMode="decimal"
                        value={editForm.amount}
                        onChange={(event) =>
                          setEditForm({ ...editForm, amount: event.target.value })
                        }
                        className={`${field} text-right`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={editForm.description}
                        onChange={(event) =>
                          setEditForm({ ...editForm, description: event.target.value })
                        }
                        className={field}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          if (
                            await onSave(row.id, {
                              ...editForm,
                              group_id: editForm.group_id || soleGroupId,
                            })
                          )
                            setEditingId(null);
                        }}
                        className="text-xs text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="ml-3 text-xs text-muted hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="px-3 py-2 font-medium">{depositPersonLabel(row)}</td>
                    <td className="px-3 py-2 text-muted">
                      {formatDepositDate(row.deposited_on)}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {depositMethodLabel(row.method)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrencyWhole(Number(row.amount))}
                    </td>
                    <td className="px-3 py-2 text-muted">{row.description ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(row.id);
                          setEditForm({
                            profile_id: row.profile_id,
                            kind: row.kind,
                            method: row.method,
                            group_id: row.group_id ?? "",
                            deposited_on: row.deposited_on,
                            amount: String(row.amount),
                            description: row.description ?? "",
                          });
                        }}
                        className="text-xs text-muted hover:text-foreground"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onDelete(row)}
                        className="ml-3 text-xs text-red-300 hover:text-red-200 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function DepositsAdmin() {
  const [deposits, setDeposits] = useState<CapitalDeposit[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [groups, setGroups] = useState<WageringStakeGroup[]>([]);
  const [stakes, setStakes] = useState<EquityStake[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [depositsResponse, usersResponse, groupsResponse, stakesResponse] =
        await Promise.all([
        fetch("/api/financials/deposits"),
        fetch("/api/users"),
        fetch("/api/financials/wagering-groups"),
        fetch("/api/financials/equity-stakes"),
      ]);

      const depositsData = (await depositsResponse.json()) as {
        deposits?: CapitalDeposit[];
        error?: string;
      };

      if (!depositsResponse.ok) {
        setError(depositsData.error ?? "Could not load deposits.");
      } else {
        setDeposits(depositsData.deposits ?? []);
        setError(null);
      }

      if (usersResponse.ok) {
        const usersData = (await usersResponse.json()) as { users?: ManagedUser[] };
        setUsers(usersData.users ?? []);
      }

      if (groupsResponse.ok) {
        const groupsData = (await groupsResponse.json()) as {
          groups?: WageringStakeGroup[];
        };
        setGroups(groupsData.groups ?? []);
      }

      if (stakesResponse.ok) {
        const stakesData = (await stakesResponse.json()) as { stakes?: EquityStake[] };
        setStakes(stakesData.stakes ?? []);
      }
    } catch {
      setError("Network error while loading deposits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(form: FormState) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/financials/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as { deposit?: CapitalDeposit; error?: string };

      if (!response.ok || !data.deposit) {
        setError(data.error ?? "Could not add the deposit.");
        return false;
      }

      setDeposits((current) => [data.deposit!, ...current]);
      return true;
    } catch {
      setError("Network error while adding the deposit.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(id: string, form: FormState) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/financials/deposits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as { deposit?: CapitalDeposit; error?: string };

      if (!response.ok || !data.deposit) {
        setError(data.error ?? "Could not update the deposit.");
        return false;
      }

      setDeposits((current) => current.map((row) => (row.id === id ? data.deposit! : row)));
      return true;
    } catch {
      setError("Network error while updating the deposit.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: CapitalDeposit) {
    if (
      !window.confirm(
        `Delete the ${formatCurrencyWhole(Number(row.amount))} deposit for ${depositPersonLabel(row)}? The stake total will drop accordingly.`,
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(`/api/financials/deposits/${row.id}`, { method: "DELETE" });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Could not delete the deposit.");
        return;
      }

      setDeposits((current) => current.filter((entry) => entry.id !== row.id));
    } catch {
      setError("Network error while deleting the deposit.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading deposits...</p>;
  }

  // Company deposits exist to recoup these, so show what is still owed.
  const outstanding: OutstandingRow[] = stakes
    .map((stake) => ({
      key: stake.id,
      label:
        stake.profile?.display_name ??
        stake.profile?.report_alias ??
        stake.profile?.email ??
        "Un-allocated",
      due: Number(stake.io_cash_value) - Number(stake.deposit),
    }))
    .filter((row) => row.due > 0)
    .sort((a, b) => b.due - a.due);

  const shared = { users, groups, busy, onCreate: create, onSave: save, onDelete: remove };

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="rounded-xl border border-red-400/30 p-4 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <DepositSection
        kind="betting"
        blurb="Capital paid into the betting pool. A deposit after inception locks existing holders at their value that day."
        rows={deposits.filter((row) => row.kind === "betting")}
        {...shared}
      />

      <DepositSection
        kind="ancillary"
        blurb="Money in that belongs to neither pool. Tracked here but it does not affect ownership or equity."
        rows={deposits.filter((row) => row.kind === "ancillary")}
        {...shared}
      />

      <DepositSection
        kind="company"
        blurb="Capital paid against an equity allocation. These deposits recoup the outstanding balance below."
        rows={deposits.filter((row) => row.kind === "company")}
        outstanding={outstanding}
        {...shared}
      />
    </div>
  );
}
