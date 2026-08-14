"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ExpenseSummaryTables } from "@/components/ExpenseSummaryTables";
import {
  CheckIcon,
  PencilIcon,
  tableActionButtonClass,
  TrashIcon,
  XIcon,
} from "@/components/TableActionIcons";
import {
  formatExpenseAmount,
  formatExpenseInput,
  getLocalTodayDateString,
  getQuarterFromDate,
  parseExpenseAmount,
  sortCatalog,
  type ExpenseComponent,
  type ExpenseCostCenter,
  type ExpenseEntry,
} from "@/lib/expenses/types";
import { getDuplicateSortOrders } from "@/lib/sort";

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
  expense_date: getLocalTodayDateString(),
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

function getCostCenterName(entry: ExpenseEntry, costCenters: ExpenseCostCenter[]) {
  const joined = entry.cost_center;
  if (joined && !Array.isArray(joined)) {
    return joined.name;
  }

  return costCenters.find((item) => item.id === entry.cost_center_id)?.name ?? "—";
}

function getComponentName(entry: ExpenseEntry, components: ExpenseComponent[]) {
  const joined = entry.component;
  if (joined && !Array.isArray(joined)) {
    return joined.name;
  }

  return components.find((item) => item.id === entry.component_id)?.name ?? "—";
}

function sortCatalogItems<T extends CatalogItem>(items: T[]) {
  return [...items].sort((a, b) => {
    if (a.is_active !== b.is_active) {
      return a.is_active ? -1 : 1;
    }

    return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
  });
}

function CatalogManager<T extends CatalogItem>({
  title,
  description,
  items,
  busyId,
  catalogEditingId,
  onCatalogEditingIdChange,
  onCreate,
  onUpdate,
  onSetArchived,
}: {
  title: string;
  description: string;
  items: T[];
  busyId: string | null;
  catalogEditingId: string | null;
  onCatalogEditingIdChange: (id: string | null) => void;
  onCreate: (payload: { name: string; sort_order: number }) => Promise<void>;
  onUpdate: (
    item: T,
    payload: { name?: string; sort_order?: number; is_active?: boolean },
  ) => Promise<void>;
  onSetArchived: (item: T, archived: boolean) => Promise<void>;
}) {
  const [form, setForm] = useState(emptyCatalogForm);
  const [creating, setCreating] = useState(false);
  const [editForm, setEditForm] = useState(emptyCatalogForm);

  const sortedItems = sortCatalogItems(items);
  const duplicateSortOrders = getDuplicateSortOrders(items);

  function startEdit(item: T) {
    onCatalogEditingIdChange(item.id);
    setEditForm({
      name: item.name,
      sort_order: String(item.sort_order),
    });
  }

  function cancelEdit() {
    onCatalogEditingIdChange(null);
    setEditForm(emptyCatalogForm());
  }

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

  async function saveEdit(item: T) {
    const name = editForm.name.trim();
    const sortOrder = Number(editForm.sort_order);

    if (!name || !Number.isFinite(sortOrder)) {
      return;
    }

    await onUpdate(item, { name, sort_order: sortOrder });
    cancelEdit();
  }

  async function handleArchive(item: T) {
    const confirmed = window.confirm(
      item.is_active
        ? `Archive "${item.name}"? Historical expenses stay linked, but it will be hidden from new dropdowns.`
        : `Restore "${item.name}" to active dropdowns?`,
    );

    if (!confirmed) {
      return;
    }

    if (catalogEditingId === item.id) {
      cancelEdit();
    }

    await onSetArchived(item, item.is_active);
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
      {duplicateSortOrders.size > 0 ? (
        <p className="mt-2 text-xs text-muted">
          Multiple items share the same order value. Ties are sorted alphabetically by name.
        </p>
      ) : null}

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
        {sortedItems.length === 0 ? (
          <p className="text-sm text-muted">No items yet.</p>
        ) : (
          sortedItems.map((item) => {
            const isBusy = busyId === item.id;
            const isEditing = catalogEditingId === item.id;

            return (
              <div
                key={item.id}
                className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${
                  item.is_active
                    ? "border-border/60"
                    : "border-border/40 bg-surface-elevated/40 opacity-80"
                }`}
              >
                {isEditing ? (
                  <>
                    <input
                      value={editForm.name}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, name: event.target.value }))
                      }
                      disabled={isBusy}
                      className="min-w-[120px] flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
                    />
                    <input
                      value={editForm.sort_order}
                      type="number"
                      disabled={isBusy}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          sort_order: event.target.value,
                        }))
                      }
                      className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
                    />
                  </>
                ) : (
                  <>
                    <p className="min-w-[120px] flex-1 text-sm font-medium">{item.name}</p>
                    <p className="w-20 text-sm text-muted">
                      Order{" "}
                      <span
                        className={
                          duplicateSortOrders.has(item.sort_order) ? "text-amber-200" : undefined
                        }
                      >
                        {item.sort_order}
                      </span>
                    </p>
                    {!item.is_active ? (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                        Archived
                      </span>
                    ) : null}
                  </>
                )}

                <div className="ml-auto flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void saveEdit(item)}
                        disabled={isBusy}
                        aria-label="Save changes"
                        title="Save"
                        className={tableActionButtonClass.save}
                      >
                        <CheckIcon />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={isBusy}
                        aria-label="Cancel edit"
                        title="Cancel"
                        className={tableActionButtonClass.cancel}
                      >
                        <XIcon />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        disabled={isBusy || catalogEditingId !== null}
                        aria-label="Edit item"
                        title="Edit"
                        className={tableActionButtonClass.edit}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleArchive(item)}
                        disabled={isBusy || catalogEditingId !== null}
                        aria-label={item.is_active ? "Archive item" : "Restore item"}
                        title={item.is_active ? "Archive" : "Restore"}
                        className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-accent/40 hover:text-foreground disabled:opacity-60"
                      >
                        {item.is_active ? "Archive" : "Restore"}
                      </button>
                    </>
                  )}
                </div>
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
  const [entryForm, setEntryForm] = useState<EntryForm>(() => ({
    ...emptyEntryForm(),
    expense_date: "",
  }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EntryForm>(emptyEntryForm);
  const [editingCostCenterCatalogId, setEditingCostCenterCatalogId] = useState<string | null>(
    null,
  );
  const [editingComponentCatalogId, setEditingComponentCatalogId] = useState<string | null>(
    null,
  );
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
        expense_date: getLocalTodayDateString(),
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

  useEffect(() => {
    setEntryForm((current) => ({
      ...current,
      expense_date: getLocalTodayDateString(),
    }));
  }, []);

  async function createEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyId("new-entry");
    setError(null);

    const amount = parseExpenseAmount(entryForm.amount);

    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid dollar amount.");
      setBusyId(null);
      return;
    }

    try {
      const response = await fetch("/api/expenses/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...entryForm,
          amount,
        }),
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

    const payload: Record<string, string | number | null> = { ...updates };

    if (updates.amount !== undefined) {
      const amount = parseExpenseAmount(updates.amount);

      if (!Number.isFinite(amount) || amount < 0) {
        setError("Enter a valid dollar amount.");
        setBusyId(null);
        return false;
      }

      payload.amount = amount;
    }

    try {
      const response = await fetch(`/api/expenses/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { entry?: ExpenseEntry; error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not update expense.");
        setBusyId(null);
        return false;
      }

      if (data.entry) {
        setEntries((current) =>
          current.map((row) => (row.id === data.entry!.id ? data.entry! : row)),
        );
      }

      return true;
    } catch {
      setError("Network error while updating expense.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(entry: ExpenseEntry) {
    setEditingId(entry.id);
    setEditForm({
      cost_center_id: entry.cost_center_id,
      component_id: entry.component_id,
      amount: formatExpenseInput(String(Math.round(entry.amount))),
      expense_date: entry.expense_date.slice(0, 10),
      notes: entry.notes ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyEntryForm());
  }

  async function saveEdit(entryId: string) {
    const entry = entries.find((row) => row.id === entryId);

    if (!entry) {
      return;
    }

    const saved = await updateEntry(entry, editForm);

    if (saved) {
      setEditingId(null);
      setEditForm(emptyEntryForm());
    }
  }

  async function deleteEntry(entry: ExpenseEntry) {
    if (!window.confirm(`Delete expense for ${formatExpenseAmount(entry.amount)}?`)) {
      return;
    }

    if (editingId === entry.id) {
      cancelEdit();
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

  async function archiveCostCenter(item: ExpenseCostCenter, archived: boolean) {
    await updateCostCenter(item, { is_active: !archived });
  }

  async function archiveComponent(item: ExpenseComponent, archived: boolean) {
    await updateComponent(item, { is_active: !archived });
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

      <ExpenseSummaryTables
        entries={entries}
        costCenters={costCenters}
        components={components}
      />

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

          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
              $
            </span>
            <input
              value={entryForm.amount}
              onChange={(event) =>
                setEntryForm((current) => ({
                  ...current,
                  amount: formatExpenseInput(event.target.value),
                }))
              }
              inputMode="numeric"
              placeholder="0"
              required
              className="w-full rounded-xl border border-border bg-background py-2 pl-7 pr-3 text-sm outline-none focus:border-accent"
            />
          </div>

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
                  const isEditing = editingId === entry.id;
                  const editQuarter = isEditing
                    ? getQuarterFromDate(editForm.expense_date)
                    : entry.quarter;

                  return (
                    <tr key={entry.id} className="border-b border-border/60 align-top">
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={editForm.cost_center_id}
                            disabled={isBusy}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                cost_center_id: event.target.value,
                              }))
                            }
                            className="w-full min-w-[120px] rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                          >
                            {costCenters.map((item) => (
                              <option key={item.id} value={item.id} disabled={!item.is_active}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          getCostCenterName(entry, costCenters)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={editForm.component_id}
                            disabled={isBusy}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                component_id: event.target.value,
                              }))
                            }
                            className="w-full min-w-[120px] rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                          >
                            {components.map((item) => (
                              <option key={item.id} value={item.id} disabled={!item.is_active}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          getComponentName(entry, components)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="relative">
                            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted">
                              $
                            </span>
                            <input
                              value={editForm.amount}
                              disabled={isBusy}
                              onChange={(event) =>
                                setEditForm((current) => ({
                                  ...current,
                                  amount: formatExpenseInput(event.target.value),
                                }))
                              }
                              inputMode="numeric"
                              className="w-28 rounded-lg border border-border bg-background py-1.5 pl-5 pr-2 text-xs outline-none focus:border-accent"
                            />
                          </div>
                        ) : (
                          formatExpenseAmount(entry.amount)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editForm.expense_date}
                            disabled={isBusy}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                expense_date: event.target.value,
                              }))
                            }
                            className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                          />
                        ) : (
                          formatInputDate(entry.expense_date)
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">{editQuarter}</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            value={editForm.notes}
                            disabled={isBusy}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                            className="w-full min-w-[160px] rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                          />
                        ) : (
                          <span className="text-muted">{entry.notes?.trim() || "—"}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void saveEdit(entry.id)}
                                disabled={isBusy}
                                aria-label="Save expense"
                                title="Save"
                                className={tableActionButtonClass.save}
                              >
                                <CheckIcon />
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                disabled={isBusy}
                                aria-label="Cancel edit"
                                title="Cancel"
                                className={tableActionButtonClass.cancel}
                              >
                                <XIcon />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(entry)}
                                disabled={isBusy || editingId !== null}
                                aria-label="Edit expense"
                                title="Edit"
                                className={tableActionButtonClass.edit}
                              >
                                <PencilIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteEntry(entry)}
                                disabled={isBusy || editingId !== null}
                                aria-label="Delete expense"
                                title="Delete"
                                className={tableActionButtonClass.delete}
                              >
                                <TrashIcon />
                              </button>
                            </>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <CatalogManager
          title="Cost centers"
          description="Edit name and order, or archive items to hide them from new expenses while keeping historical links."
          items={costCenters}
          busyId={busyId}
          catalogEditingId={editingCostCenterCatalogId}
          onCatalogEditingIdChange={setEditingCostCenterCatalogId}
          onCreate={createCostCenter}
          onUpdate={updateCostCenter}
          onSetArchived={archiveCostCenter}
        />
        <CatalogManager
          title="Components"
          description="Edit name and order, or archive items to hide them from new expenses while keeping historical links."
          items={components}
          busyId={busyId}
          catalogEditingId={editingComponentCatalogId}
          onCatalogEditingIdChange={setEditingComponentCatalogId}
          onCreate={createComponent}
          onUpdate={updateComponent}
          onSetArchived={archiveComponent}
        />
      </div>
    </div>
  );
}
