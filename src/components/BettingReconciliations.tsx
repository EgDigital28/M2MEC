"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { formatCurrencyWhole } from "@/lib/bets/calculations";
import {
  formatReconciliationDate,
  reconciliationPersonLabel,
  sumReconciliations,
  type BettingReconciliation,
} from "@/lib/financials/reconciliations";
import type { ManagedUser } from "@/lib/users/types";

const emptyForm = () => ({
  profile_id: "",
  paid_on: "",
  amount: "",
  description: "",
});

type FormState = ReturnType<typeof emptyForm>;

function personLabel(user: Pick<ManagedUser, "display_name" | "email">) {
  return user.display_name?.trim() ? `${user.display_name} (${user.email})` : user.email;
}

function amountClass(amount: number) {
  return amount < 0 ? "text-red-400" : "text-emerald-400";
}

export function BettingReconciliations() {
  const [rows, setRows] = useState<BettingReconciliation[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [rowsResponse, usersResponse] = await Promise.all([
        fetch("/api/financials/reconciliations"),
        fetch("/api/users"),
      ]);

      const rowsData = (await rowsResponse.json()) as {
        reconciliations?: BettingReconciliation[];
        error?: string;
      };

      if (!rowsResponse.ok) {
        setError(rowsData.error ?? "Could not load reconciliations.");
      } else {
        setRows(rowsData.reconciliations ?? []);
        setError(null);
      }

      if (usersResponse.ok) {
        const usersData = (await usersResponse.json()) as { users?: ManagedUser[] };
        setUsers(usersData.users ?? []);
      }
    } catch {
      setError("Network error while loading reconciliations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(() => sumReconciliations(rows), [rows]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/financials/reconciliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = (await response.json()) as {
        reconciliation?: BettingReconciliation;
        error?: string;
      };

      if (!response.ok || !data.reconciliation) {
        setError(data.error ?? "Could not add the entry.");
        return;
      }

      setRows((current) => [data.reconciliation!, ...current]);
      setForm(emptyForm());
    } catch {
      setError("Network error while adding the entry.");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(row: BettingReconciliation) {
    setEditingId(row.id);
    setEditForm({
      profile_id: row.profile_id,
      paid_on: row.paid_on,
      amount: String(row.amount),
      description: row.description,
    });
  }

  async function saveEdit(id: string) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/financials/reconciliations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const data = (await response.json()) as {
        reconciliation?: BettingReconciliation;
        error?: string;
      };

      if (!response.ok || !data.reconciliation) {
        setError(data.error ?? "Could not update the entry.");
        return;
      }

      setRows((current) =>
        current.map((row) => (row.id === id ? data.reconciliation! : row)),
      );
      setEditingId(null);
    } catch {
      setError("Network error while updating the entry.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: BettingReconciliation) {
    if (
      !window.confirm(
        `Delete the ${formatCurrencyWhole(Number(row.amount))} entry for ${reconciliationPersonLabel(row)}?`,
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(`/api/financials/reconciliations/${row.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Could not delete the entry.");
        return;
      }

      setRows((current) => current.filter((entry) => entry.id !== row.id));
    } catch {
      setError("Network error while deleting the entry.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent";
  const label = "text-[10px] font-semibold uppercase tracking-widest text-muted";

  return (
    <section aria-labelledby="reconciliations" className="space-y-4">
      <div>
        <h2 id="reconciliations" className="text-xl font-semibold">
          Betting reconciliation
        </h2>
        <p className="mt-2 text-sm text-muted">
          Cash settled with an individual outside the wager ledger. Enter a positive amount for
          money paid out to them and a negative amount for money collected from them.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-400/30 p-4 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={create}
        className="grid gap-3 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="lg:col-span-1">
          <span className={label}>Person</span>
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
        <label>
          <span className={label}>Date</span>
          <input
            required
            type="date"
            value={form.paid_on}
            onChange={(event) => setForm({ ...form, paid_on: event.target.value })}
            className={`mt-2 ${field}`}
          />
        </label>
        <label>
          <span className={label}>Amount</span>
          <input
            required
            inputMode="decimal"
            placeholder="2500 or -2500"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            className={`mt-2 ${field}`}
          />
        </label>
        <label className="lg:col-span-1">
          <span className={label}>Description</span>
          <input
            required
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Q3 settlement"
            className={`mt-2 ${field}`}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-auto rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
        >
          Add entry
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Loading entries...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No reconciliation entries yet.
                </td>
              </tr>
            ) : (
              rows.map((row) =>
                editingId === row.id ? (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        value={editForm.paid_on}
                        onChange={(event) =>
                          setEditForm({ ...editForm, paid_on: event.target.value })
                        }
                        className={field}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        inputMode="decimal"
                        value={editForm.amount}
                        onChange={(event) =>
                          setEditForm({ ...editForm, amount: event.target.value })
                        }
                        className={`${field} text-right`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={editForm.description}
                        onChange={(event) =>
                          setEditForm({ ...editForm, description: event.target.value })
                        }
                        className={field}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void saveEdit(row.id)}
                        disabled={busy}
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
                    <td className="px-4 py-3 font-medium">{reconciliationPersonLabel(row)}</td>
                    <td className="px-4 py-3 text-muted">
                      {formatReconciliationDate(row.paid_on)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${amountClass(Number(row.amount))}`}
                    >
                      {Number(row.amount) > 0 ? "+" : ""}
                      {formatCurrencyWhole(Number(row.amount))}
                    </td>
                    <td className="px-4 py-3 text-muted">{row.description}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="text-xs text-muted hover:text-foreground"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(row)}
                        disabled={busy}
                        className="ml-3 text-xs text-red-300 hover:text-red-200 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ),
              )
            )}
            {rows.length > 0 ? (
              <tr className="font-semibold">
                <td className="px-4 py-3">Net</td>
                <td className="px-4 py-3" />
                <td className={`px-4 py-3 text-right tabular-nums ${amountClass(total)}`}>
                  {total > 0 ? "+" : ""}
                  {formatCurrencyWhole(total)}
                </td>
                <td className="px-4 py-3" colSpan={2} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
