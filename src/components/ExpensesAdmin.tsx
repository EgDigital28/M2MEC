"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  formatExpenseAmount,
  getQuarterFromDate,
  sortCatalog,
  type ExpenseComponent,
  type ExpenseCostCenter,
  type ExpenseEntry,
} from "@/lib/expenses/types";

type CatalogItem = ExpenseCostCenter | ExpenseComponent;

type EntryForm = {
  cost_center_id: string;
  component_id: string;
  amount: string;
  expense_date: string;
  notes: string;
};

type CatalogForm = {
  name: string;
  sort_order: string;
};

const emptyEntryForm = (): EntryForm => ({
  cost_center_id: "",
  component_id: "",
  amount: "",
  expense_date: new Date().toISOString().slice(0, 10),
  notes: "",
});

const emptyCatalogForm = (): CatalogForm => ({
  name: "",
  sort_order: "0",
});

function formatInputDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function CatalogManager<T extends CatalogItem>({
  title,
  description,
  items,
  busyId,
  onCreate,
  onUpdate,
  onDelete,
}: {
  title: string;
  description: string;
  items: T[];
  busyId: string | null;
  onCreate: (payload: { name: string; sort_order: number }) => Promise<void>;
  onUpdate: (
    item: T,
    payload: { name?: string; sort_order?: number; is_active?: boolean },
  ) => Promise<void>;
  onDelete: (item: T) => Promise<void>;
}) {
  const [form, setForm] = useState(emptyCatalogForm);
  const [creating, setCreating] = useState(false);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    await onCreate({
      name: form.name.trim(),
      sort_order: Number(form.sort_order) || 0,
    });
    setForm(emptyCatalogForm());
    setCreating(false);
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>

      <form onSubmit={handleCreate} className="mt-4 flex flex-wrap gap-2">
        <input
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Name"
          required
          className="min-w-[140px] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          value={form.sort_order}
          onChange={(event) =>
            setForm((current) => ({ ...current, sort_order: event.target.value }))
          }
          type="number"
          placeholder="Order"
          className="w-24 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-accent/40 disabled:opacity-60"
        >
          {creating ? "Adding..." : "Add"}
        </button>
      </form>

      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted">No items yet.</p>
        ) : (
          items.map((item) => {
            const isBusy = busyId === item.id;

            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 px-3 py-2"
              >
                <input
                  defaultValue={item.name}
                  disabled={isBusy}
                  onBlur={(event) => {
                    const name = event.target.value.trim();
                    if (name && name !== item.name) {
                      void onUpdate(item, { name });
                    }
                  }}
                  className="min-w-[120px] flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
                />
                <input
                  defaultValue={String(item.sort_order)}
                  type="number"
                  disabled={isBusy}
                  onBlur={(event) => {
                    const sortOrder = Number(event.target.value);
                    if (Number.isFinite(sortOrder) && sortOrder !== item.sort_order) {
                      void onUpdate(item, { sort_order: sortOrder });
                    }
                  }}
                  className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
                />
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={item.is_active}
                    disabled={isBusy}
                    onChange={(event) =>
                      void onUpdate(item, { is_active: event.target.checked })
                    }
                  />
                  Active
                </label>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void onDelete(item)}
                  className="rounded-full border border-red-500/30 px-3 py-1 text-xs text-red-300 transition-colors hover:border-red-400/50 disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export function ExpensesAdmin() {
  const [costCenters, setCostCenters] = useState<ExpenseCostCenter[]>([]);
  const [components, setComponents] = useState<ExpenseComponent[]>([]);
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [entryForm, setEntryForm] = useState<EntryForm>(emptyEntryForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [migrationRequired, setMigrationRequired] = useState(false);

  const activeCostCenters = useMemo(
    () => costCenters.filter((item) => item.is_active),
    [costCenters],
  );
  const activeComponents = useMemo(
    () => components.filter((item) => item.is_active),
    [components],
  );

  const previewQuarter = entryForm.expense_date
    ? getQuarterFromDate(entryForm.expense_date)
    : "—";

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMigrationRequired(false);

    try {
      const [costCenterRes, componentRes, entryRes] = await Promise.all([
        fetch("/api/expenses/cost-centers"),
        fetch("/api/expenses/components"),
        fetch("/api/expenses/entries"),
      ]);

      const costCenterData = (await costCenterRes.json()) as {
        costCenters?: ExpenseCostCenter[];
        error?: string;
      };
      const componentData = (await componentRes.json()) as {
        components?: ExpenseComponent[];
        error?: string;
      };
      const entryData = (await entryRes.json()) as {
        entries?: ExpenseEntry[];
        error?: string;
      };

      if (!costCenterRes.ok || !componentRes.ok) {
        setError(costCenterData.error ?? componentData.error ?? "Could not load expense settings.");
        setLoading(false);
        return;
      }

      if (!entryRes.ok) {
        if (entryRes.status === 503) {
          setMigrationRequired(true);
        } else {
          setError(entryData.error ?? "Could not load expense entries.");
          setLoading(false);
          return;
        }
      }

      setCostCenters(sortCatalog(costCenterData.costCenters ?? []));
      setComponents(sortCatalog(componentData.components ?? []));
      setEntries(entryData.entries ?? []);

      setEntryForm((current) => ({
        ...current,
        cost_center_id: current.cost_center_id || costCenterData.costCenters?.[0]?.id || "",
        component_id: current.component_id || componentData.components?.[0]?.id || "",
      }));
    } catch {
      setError("Network error while loading expenses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function createEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyId("new-entry");
    setError(null);

    try {
      const response = await fetch("/api/expenses/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entryForm),
      });

      const data = (await response.json()) as { entry?: ExpenseEntry; error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not add expense.");
        setBusyId(null);
        return;
      }

      if (data.entry) {
        setEntries((current) => [data.entry!, ...current]);
      }

      setEntryForm((current) => ({
        ...emptyEntryForm(),
        cost_center_id: current.cost_center_id,
        component_id: current.component_id,
      }));
    } catch {
      setError("Network error while adding expense.");
    } finally {
      setBusyId(null);
    }
  }

  async function updateEntry(entry: ExpenseEntry, updates: Partial<EntryForm>) {
    setBusyId(entry.id);
    setError(null);

    try {
      const response = await fetch(`/api/expenses/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = (await response.json()) as { entry?: ExpenseEntry; error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not update expense.");
        setBusyId(null);
        return;
      }

      if (data.entry) {
        setEntries((current) =>
          current.map((row) => (row.id === data.entry!.id ? data.entry! : row)),
        );
      }
    } catch {
      setError("Network error while updating expense.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteEntry(entry: ExpenseEntry) {
    if (!window.confirm(`Delete expense for ${formatExpenseAmount(entry.amount)}?`)) {
      return;
    }

    setBusyId(entry.id);
    setError(null);

    try {
      const response = await fetch(`/api/expenses/entries/${entry.id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not delete expense.");
        setBusyId(null);
        return;
      }

      setEntries((current) => current.filter((row) => row.id !== entry.id));
    } catch {
      setError("Network error while deleting expense.");
    } finally {
      setBusyId(null);
    }
  }

  async function createCostCenter(payload: { name: string; sort_order: number }) {
    const response = await fetch("/api/expenses/cost-centers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { costCenter?: ExpenseCostCenter; error?: string };
    if (!response.ok) {
      setError(data.error ?? "Could not create cost center.");
      return;
    }
    if (data.costCenter) {
      setCostCenters((current) => sortCatalog([...current, data.costCenter!]));
    }
  }

  async function updateCostCenter(
    item: ExpenseCostCenter,
    payload: { name?: string; sort_order?: number; is_active?: boolean },
  ) {
    setBusyId(item.id);
    const response = await fetch(`/api/expenses/cost-centers/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { costCenter?: ExpenseCostCenter; error?: string };
    setBusyId(null);
    if (!response.ok) {
      setError(data.error ?? "Could not update cost center.");
      return;
    }
    if (data.costCenter) {
      setCostCenters((current) =>
        sortCatalog(current.map((row) => (row.id === data.costCenter!.id ? data.costCenter! : row))),
      );
    }
  }

  async function deleteCostCenter(item: ExpenseCostCenter) {
    if (!window.confirm(`Delete cost center "${item.name}"?`)) {
      return;
    }
    setBusyId(item.id);
    const response = await fetch(`/api/expenses/cost-centers/${item.id}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    setBusyId(null);
    if (!response.ok) {
      setError(data.error ?? "Could not delete cost center.");
      return;
    }
    setCostCenters((current) => current.filter((row) => row.id !== item.id));
  }

  async function createComponent(payload: { name: string; sort_order: number }) {
    const response = await fetch("/api/expenses/components", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { component?: ExpenseComponent; error?: string };
    if (!response.ok) {
      setError(data.error ?? "Could not create component.");
      return;
    }
    if (data.component) {
      setComponents((current) => sortCatalog([...current, data.component!]));
    }
  }

  async function updateComponent(
    item: ExpenseComponent,
    payload: { name?: string; sort_order?: number; is_active?: boolean },
  ) {
    setBusyId(item.id);
    const response = await fetch(`/api/expenses/components/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { component?: ExpenseComponent; error?: string };
    setBusyId(null);
    if (!response.ok) {
      setError(data.error ?? "Could not update component.");
      return;
    }
    if (data.component) {
      setComponents((current) =>
        sortCatalog(current.map((row) => (row.id === data.component!.id ? data.component! : row))),
      );
    }
  }

  async function deleteComponent(item: ExpenseComponent) {
    if (!window.confirm(`Delete component "${item.name}"?`)) {
      return;
    }
    setBusyId(item.id);
    const response = await fetch(`/api/expenses/components/${item.id}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    setBusyId(null);
    if (!response.ok) {
      setError(data.error ?? "Could not delete component.");
      return;
    }
    setComponents((current) => current.filter((row) => row.id !== item.id));
  }

  return (
    <div className="space-y-6">
      {migrationRequired && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Run <code className="text-foreground">010_expenses.sql</code> in Supabase to enable expense
          tracking.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-border bg-surface-elevated p-5">
        <h2 className="text-lg font-semibold">Add expense</h2>
        <form onSubmit={createEntry} className="mt-4 grid gap-3 md:grid-cols-6">
          <select
            value={entryForm.cost_center_id}
            onChange={(event) =>
              setEntryForm((current) => ({ ...current, cost_center_id: event.target.value }))
            }
            required
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="" disabled>
              Cost center
            </option>
            {activeCostCenters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <select
            value={entryForm.component_id}
            onChange={(event) =>
              setEntryForm((current) => ({ ...current, component_id: event.target.value }))
            }
            required
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="" disabled>
              Component
            </option>
            {activeComponents.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>

          <input
            value={entryForm.amount}
            onChange={(event) =>
              setEntryForm((current) => ({ ...current, amount: event.target.value }))
            }
            placeholder="Amount"
            required
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />

          <input
            type="date"
            value={entryForm.expense_date}
            onChange={(event) =>
              setEntryForm((current) => ({ ...current, expense_date: event.target.value }))
            }
            required
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />

          <div className="flex items-center rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted">
            Qtr: <span className="ml-2 font-medium text-foreground">{previewQuarter}</span>
          </div>

          <button
            type="submit"
            disabled={busyId === "new-entry"}
            className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busyId === "new-entry" ? "Adding..." : "Add line item"}
          </button>

          <input
            value={entryForm.notes}
            onChange={(event) =>
              setEntryForm((current) => ({ ...current, notes: event.target.value }))
            }
            placeholder="Notes"
            className="md:col-span-6 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-elevated text-left text-muted">
                <th className="px-4 py-3 font-medium">Cost center</th>
                <th className="px-4 py-3 font-medium">Component</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Qtr</th>
                <th className="px-4 py-3 font-medium">Notes</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    Loading expenses...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    No expense line items yet.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const isBusy = busyId === entry.id;

                  return (
                    <tr key={entry.id} className="border-b border-border/60 align-top">
                      <td className="px-4 py-3">
                        <select
                          defaultValue={entry.cost_center_id}
                          disabled={isBusy}
                          onChange={(event) =>
                            void updateEntry(entry, { cost_center_id: event.target.value })
                          }
                          className="w-full min-w-[120px] rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                        >
                          {costCenters.map((item) => (
                            <option key={item.id} value={item.id} disabled={!item.is_active}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          defaultValue={entry.component_id}
                          disabled={isBusy}
                          onChange={(event) =>
                            void updateEntry(entry, { component_id: event.target.value })
                          }
                          className="w-full min-w-[120px] rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                        >
                          {components.map((item) => (
                            <option key={item.id} value={item.id} disabled={!item.is_active}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          defaultValue={String(entry.amount)}
                          disabled={isBusy}
                          onBlur={(event) => {
                            const amount = event.target.value.trim();
                            if (amount && amount !== String(entry.amount)) {
                              void updateEntry(entry, { amount });
                            }
                          }}
                          className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          defaultValue={entry.expense_date.slice(0, 10)}
                          disabled={isBusy}
                          onBlur={(event) => {
                            const expense_date = event.target.value;
                            if (expense_date && expense_date !== entry.expense_date.slice(0, 10)) {
                              void updateEntry(entry, { expense_date });
                            }
                          }}
                          className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                        />
                        <p className="mt-1 text-[11px] text-muted">
                          {formatInputDate(entry.expense_date)}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-medium">{entry.quarter}</td>
                      <td className="px-4 py-3">
                        <input
                          defaultValue={entry.notes ?? ""}
                          disabled={isBusy}
                          onBlur={(event) => {
                            const notes = event.target.value;
                            if (notes !== (entry.notes ?? "")) {
                              void updateEntry(entry, { notes });
                            }
                          }}
                          className="w-full min-w-[160px] rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void deleteEntry(entry)}
                          className="rounded-full border border-red-500/30 px-3 py-1.5 text-[11px] text-red-300 transition-colors hover:border-red-400/50 disabled:opacity-60"
                        >
                          Delete
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

      <div className="grid gap-6 lg:grid-cols-2">
        <CatalogManager
          title="Cost centers"
          description="Manage the cost center list used in expense line items."
          items={costCenters}
          busyId={busyId}
          onCreate={createCostCenter}
          onUpdate={updateCostCenter}
          onDelete={deleteCostCenter}
        />
        <CatalogManager
          title="Components"
          description="Manage the component list used in expense line items."
          items={components}
          busyId={busyId}
          onCreate={createComponent}
          onUpdate={updateComponent}
          onDelete={deleteComponent}
        />
      </div>
    </div>
  );
}
