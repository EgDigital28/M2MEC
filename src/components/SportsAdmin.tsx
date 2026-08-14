"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Sport } from "@/lib/sports/types";

const emptyForm = {
  abbreviation: "",
  full_name: "",
  is_active: true,
  sort_order: "0",
};

export function SportsAdmin() {
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  const loadSports = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/sports");
      const data = (await response.json()) as { sports?: Sport[]; error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not load sports.");
        setLoading(false);
        return;
      }

      setSports(data.sports ?? []);
    } catch {
      setError("Network error while loading sports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSports();
  }, [loadSports]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/sports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abbreviation: form.abbreviation,
          full_name: form.full_name,
          is_active: form.is_active,
          sort_order: Number(form.sort_order),
        }),
      });

      const data = (await response.json()) as { sport?: Sport; error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not create sport.");
        setSubmitting(false);
        return;
      }

      if (data.sport) {
        setSports((current) => [...current, data.sport!].sort(sortSports));
      }

      setForm(emptyForm);
    } catch {
      setError("Network error while creating sport.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(sport: Sport) {
    setEditingId(sport.id);
    setEditForm({
      abbreviation: sport.abbreviation,
      full_name: sport.full_name,
      is_active: sport.is_active,
      sort_order: String(sport.sort_order),
    });
  }

  async function saveEdit(id: string) {
    setError(null);

    try {
      const response = await fetch(`/api/sports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abbreviation: editForm.abbreviation,
          full_name: editForm.full_name,
          is_active: editForm.is_active,
          sort_order: Number(editForm.sort_order),
        }),
      });

      const data = (await response.json()) as { sport?: Sport; error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not update sport.");
        return;
      }

      if (data.sport) {
        setSports((current) =>
          current
            .map((sport) => (sport.id === id ? data.sport! : sport))
            .sort(sortSports),
        );
      }

      setEditingId(null);
    } catch {
      setError("Network error while updating sport.");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this sport? It must not be used by any bet entries.")) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/sports/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not delete sport.");
        return;
      }

      setSports((current) => current.filter((sport) => sport.id !== id));
    } catch {
      setError("Network error while deleting sport.");
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-surface-elevated p-6">
        <h2 className="text-lg font-semibold">Add sport</h2>
        <p className="mt-1 text-sm text-muted">
          Abbreviation appears in the ledger. Full name is for reference.
        </p>

        <form onSubmit={handleCreate} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label htmlFor="abbreviation" className="mb-1.5 block text-sm font-medium">
              Abbreviation
            </label>
            <input
              id="abbreviation"
              required
              value={form.abbreviation}
              onChange={(event) =>
                setForm((current) => ({ ...current, abbreviation: event.target.value }))
              }
              placeholder="NFL"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="full_name" className="mb-1.5 block text-sm font-medium">
              Full name
            </label>
            <input
              id="full_name"
              required
              value={form.full_name}
              onChange={(event) =>
                setForm((current) => ({ ...current, full_name: event.target.value }))
              }
              placeholder="National Football League"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>

          <div>
            <label htmlFor="sort_order" className="mb-1.5 block text-sm font-medium">
              Sort order
            </label>
            <input
              id="sort_order"
              type="number"
              value={form.sort_order}
              onChange={(event) =>
                setForm((current) => ({ ...current, sort_order: event.target.value }))
              }
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) =>
                  setForm((current) => ({ ...current, is_active: event.target.checked }))
                }
                className="rounded border-border"
              />
              Active in ledger dropdown
            </label>
          </div>

          <div className="md:col-span-2 xl:col-span-4">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Adding..." : "Add sport"}
            </button>
          </div>
        </form>
      </section>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-border">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-elevated text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Abbreviation</th>
                <th className="px-4 py-3 font-medium">Full name</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    Loading sports...
                  </td>
                </tr>
              ) : sports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    No sports configured.
                  </td>
                </tr>
              ) : (
                sports.map((sport) => {
                  const isEditing = editingId === sport.id;

                  return (
                    <tr key={sport.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            value={editForm.abbreviation}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                abbreviation: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-border bg-background px-2 py-1"
                          />
                        ) : (
                          <span className={sport.is_active ? "font-medium" : "text-muted"}>
                            {sport.abbreviation}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            value={editForm.full_name}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                full_name: event.target.value,
                              }))
                            }
                            className="w-full rounded-lg border border-border bg-background px-2 py-1"
                          />
                        ) : (
                          sport.full_name
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.sort_order}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                sort_order: event.target.value,
                              }))
                            }
                            className="w-20 rounded-lg border border-border bg-background px-2 py-1"
                          />
                        ) : (
                          sport.sort_order
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={editForm.is_active}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                is_active: event.target.checked,
                              }))
                            }
                          />
                        ) : sport.is_active ? (
                          "Yes"
                        ) : (
                          "No"
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => saveEdit(sport.id)}
                              className="text-xs text-accent hover:underline"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="text-xs text-muted hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(sport)}
                              className="text-xs text-accent hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(sport.id)}
                              className="text-xs text-red-300 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        )}
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

function sortSports(a: Sport, b: Sport) {
  if (a.sort_order !== b.sort_order) {
    return a.sort_order - b.sort_order;
  }

  return a.abbreviation.localeCompare(b.abbreviation);
}
