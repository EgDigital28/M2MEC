"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  PencilIcon,
  tableActionButtonClass,
  TrashIcon,
  XIcon,
} from "@/components/TableActionIcons";
import {
  computeAmountDue,
  computeDepositPct,
  formatAllocationPercent,
  formatDepositPct,
  formatFinancialAmount,
  formatFinancialInput,
  parseFinancialAmount,
  stakeholderLabel,
  sumAllocations,
  type EquityStake,
  type EquityStakeholder,
} from "@/lib/financials/types";

type StakeForm = {
  profile_id: string;
  io_allocation: string;
  io_cash_value: string;
  deposit: string;
};

const formFieldClassName =
  "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent";

const moneyCellClassName = "whitespace-nowrap text-right font-mono tabular-nums";

const emptyStakeForm = (): StakeForm => ({
  profile_id: "",
  io_allocation: "",
  io_cash_value: "",
  deposit: "",
});

function getStakeholder(stake: EquityStake, stakeholders: EquityStakeholder[]) {
  const joined = stake.profile;
  if (joined && !Array.isArray(joined)) {
    return joined;
  }

  return stakeholders.find((item) => item.id === stake.profile_id) ?? null;
}

export function FinancialsAdmin() {
  const [stakes, setStakes] = useState<EquityStake[]>([]);
  const [stakeholders, setStakeholders] = useState<EquityStakeholder[]>([]);
  const [form, setForm] = useState<StakeForm>(emptyStakeForm);
  const [editForm, setEditForm] = useState<StakeForm>(emptyStakeForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [migrationRequired, setMigrationRequired] = useState(false);

  const allocationTotal = useMemo(() => sumAllocations(stakes), [stakes]);
  const allocationRemaining = Math.max(0, 100 - allocationTotal);

  const assignedProfileIds = useMemo(
    () => new Set(stakes.map((stake) => stake.profile_id)),
    [stakes],
  );

  const previewCashValue = parseFinancialAmount(form.io_cash_value);
  const previewDeposit = parseFinancialAmount(form.deposit);
  const previewDepositPct =
    Number.isFinite(previewCashValue) && previewCashValue > 0 && Number.isFinite(previewDeposit)
      ? formatDepositPct(previewDeposit, previewCashValue)
      : "—";
  const previewAmountDue =
    Number.isFinite(previewCashValue) && Number.isFinite(previewDeposit)
      ? formatFinancialAmount(computeAmountDue(previewCashValue, previewDeposit))
      : "—";

  const totals = useMemo(
    () =>
      stakes.reduce(
        (acc, stake) => {
          acc.ioCashValue += stake.io_cash_value;
          acc.deposit += stake.deposit;
          acc.amountDue += computeAmountDue(stake.io_cash_value, stake.deposit);
          return acc;
        },
        { ioCashValue: 0, deposit: 0, amountDue: 0 },
      ),
    [stakes],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMigrationRequired(false);

    try {
      const [stakesRes, stakeholdersRes] = await Promise.all([
        fetch("/api/financials/equity-stakes"),
        fetch("/api/financials/stakeholders"),
      ]);

      const stakesData = (await stakesRes.json()) as {
        stakes?: EquityStake[];
        error?: string;
      };
      const stakeholdersData = (await stakeholdersRes.json()) as {
        stakeholders?: EquityStakeholder[];
        error?: string;
      };

      if (!stakeholdersRes.ok) {
        setError(stakeholdersData.error ?? "Could not load stakeholders.");
        setLoading(false);
        return;
      }

      if (!stakesRes.ok) {
        if (stakesRes.status === 503) {
          setMigrationRequired(true);
        } else {
          setError(stakesData.error ?? "Could not load equity stakes.");
          setLoading(false);
          return;
        }
      }

      setStakeholders(stakeholdersData.stakeholders ?? []);
      setStakes(stakesData.stakes ?? []);
    } catch {
      setError("Network error while loading financials.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function availableStakeholders(currentProfileId = "") {
    return stakeholders.filter(
      (stakeholder) =>
        !assignedProfileIds.has(stakeholder.id) || stakeholder.id === currentProfileId,
    );
  }

  async function createStake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyId("new-stake");
    setError(null);

    const ioAllocation = Number(form.io_allocation);
    const ioCashValue = parseFinancialAmount(form.io_cash_value);
    const deposit = parseFinancialAmount(form.deposit);

    if (
      !form.profile_id ||
      !Number.isFinite(ioAllocation) ||
      ioAllocation <= 0 ||
      ioAllocation > 100 ||
      !Number.isFinite(ioCashValue) ||
      ioCashValue < 0 ||
      !Number.isFinite(deposit) ||
      deposit < 0
    ) {
      setError("Enter a valid investor, allocation, cash value, and deposit.");
      setBusyId(null);
      return;
    }

    try {
      const response = await fetch("/api/financials/equity-stakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: form.profile_id,
          io_allocation: ioAllocation,
          io_cash_value: ioCashValue,
          deposit,
        }),
      });

      const data = (await response.json()) as { stake?: EquityStake; error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not add equity stake.");
        setBusyId(null);
        return;
      }

      if (data.stake) {
        setStakes((current) =>
          [...current, data.stake!].sort(
            (a, b) => b.io_allocation - a.io_allocation || a.created_at.localeCompare(b.created_at),
          ),
        );
      }

      setForm(emptyStakeForm());
    } catch {
      setError("Network error while adding equity stake.");
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(stake: EquityStake) {
    setEditingId(stake.id);
    setEditForm({
      profile_id: stake.profile_id,
      io_allocation: String(stake.io_allocation),
      io_cash_value: formatFinancialInput(String(Math.round(stake.io_cash_value))),
      deposit: formatFinancialInput(String(Math.round(stake.deposit))),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyStakeForm());
  }

  async function saveEdit(stakeId: string) {
    const ioAllocation = Number(editForm.io_allocation);
    const ioCashValue = parseFinancialAmount(editForm.io_cash_value);
    const deposit = parseFinancialAmount(editForm.deposit);

    if (
      !editForm.profile_id ||
      !Number.isFinite(ioAllocation) ||
      ioAllocation <= 0 ||
      ioAllocation > 100 ||
      !Number.isFinite(ioCashValue) ||
      ioCashValue < 0 ||
      !Number.isFinite(deposit) ||
      deposit < 0
    ) {
      setError("Enter a valid investor, allocation, cash value, and deposit.");
      return;
    }

    setBusyId(stakeId);
    setError(null);

    try {
      const response = await fetch(`/api/financials/equity-stakes/${stakeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: editForm.profile_id,
          io_allocation: ioAllocation,
          io_cash_value: ioCashValue,
          deposit,
        }),
      });

      const data = (await response.json()) as { stake?: EquityStake; error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not update equity stake.");
        setBusyId(null);
        return;
      }

      if (data.stake) {
        setStakes((current) =>
          current
            .map((stake) => (stake.id === stakeId ? data.stake! : stake))
            .sort(
              (a, b) => b.io_allocation - a.io_allocation || a.created_at.localeCompare(b.created_at),
            ),
        );
      }

      cancelEdit();
    } catch {
      setError("Network error while updating equity stake.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteStake(stake: EquityStake) {
    const label = getStakeholder(stake, stakeholders);
    const name = label ? stakeholderLabel(label) : "this investor";

    if (!window.confirm(`Delete equity stake for ${name}?`)) {
      return;
    }

    if (editingId === stake.id) {
      cancelEdit();
    }

    setBusyId(stake.id);
    setError(null);

    try {
      const response = await fetch(`/api/financials/equity-stakes/${stake.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not delete equity stake.");
        setBusyId(null);
        return;
      }

      setStakes((current) => current.filter((row) => row.id !== stake.id));
    } catch {
      setError("Network error while deleting equity stake.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {migrationRequired && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Run <code className="text-foreground">014_equity_stakes.sql</code> in Supabase to enable
          equity stake tracking.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-border bg-surface-elevated p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Equity stake</h2>
            <p className="mt-1 text-sm text-muted">
              Track IO allocation, cash value, deposits, and amount due for registered investors
              and admin users.
            </p>
          </div>
          <p className="text-sm text-muted">
            {formatAllocationPercent(allocationTotal)} allocated ·{" "}
            {formatAllocationPercent(allocationRemaining)} remaining
          </p>
        </div>

        <form onSubmit={createStake} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select
            value={form.profile_id}
            onChange={(event) =>
              setForm((current) => ({ ...current, profile_id: event.target.value }))
            }
            required
            className={formFieldClassName}
          >
            <option value="" disabled>
              Investor
            </option>
            {availableStakeholders().map((stakeholder) => (
              <option key={stakeholder.id} value={stakeholder.id}>
                {stakeholderLabel(stakeholder)}
              </option>
            ))}
          </select>

          <input
            value={form.io_allocation}
            onChange={(event) =>
              setForm((current) => ({ ...current, io_allocation: event.target.value }))
            }
            inputMode="decimal"
            placeholder="IO allocation %"
            required
            className={formFieldClassName}
          />

          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
              $
            </span>
            <input
              value={form.io_cash_value}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  io_cash_value: formatFinancialInput(event.target.value),
                }))
              }
              inputMode="numeric"
              placeholder="IO cash value"
              required
              className={`${formFieldClassName} pl-7`}
            />
          </div>

          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
              $
            </span>
            <input
              value={form.deposit}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  deposit: formatFinancialInput(event.target.value),
                }))
              }
              inputMode="numeric"
              placeholder="Deposit"
              required
              className={`${formFieldClassName} pl-7`}
            />
          </div>

          <div className={`flex items-center ${formFieldClassName} text-muted`}>
            Deposit %: <span className="ml-2 font-medium text-foreground">{previewDepositPct}</span>
          </div>

          <div className={`flex items-center ${formFieldClassName} text-muted`}>
            Amount due: <span className="ml-2 font-medium text-foreground">{previewAmountDue}</span>
          </div>

          <div className="md:col-span-2 xl:col-span-2">
            <button
              type="submit"
              disabled={busyId === "new-stake" || availableStakeholders().length === 0}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busyId === "new-stake" ? "Adding..." : "Add equity stake"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-elevated text-left text-muted">
                <th className="px-4 py-3 font-medium">Investor</th>
                <th className="px-4 py-3 text-right font-medium">IO Allocation</th>
                <th className="px-4 py-3 text-right font-medium">IO Cash Value</th>
                <th className="px-4 py-3 text-right font-medium">Deposit</th>
                <th className="px-4 py-3 text-right font-medium">Deposit %</th>
                <th className="px-4 py-3 text-right font-medium">Amount Due</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    Loading equity stakes...
                  </td>
                </tr>
              ) : stakes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    No equity stakes yet.
                  </td>
                </tr>
              ) : (
                stakes.map((stake) => {
                  const isEditing = editingId === stake.id;
                  const isBusy = busyId === stake.id;
                  const stakeholder = getStakeholder(stake, stakeholders);
                  const editCashValue = parseFinancialAmount(editForm.io_cash_value);
                  const editDeposit = parseFinancialAmount(editForm.deposit);

                  return (
                    <tr key={stake.id} className="border-b border-border/60 align-top">
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={editForm.profile_id}
                            disabled={isBusy}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                profile_id: event.target.value,
                              }))
                            }
                            className="w-full min-w-[180px] rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                          >
                            {availableStakeholders(stake.profile_id).map((item) => (
                              <option key={item.id} value={item.id}>
                                {stakeholderLabel(item)}
                              </option>
                            ))}
                          </select>
                        ) : stakeholder ? (
                          stakeholderLabel(stakeholder)
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${moneyCellClassName} px-4 py-3`}>
                        {isEditing ? (
                          <input
                            value={editForm.io_allocation}
                            disabled={isBusy}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                io_allocation: event.target.value,
                              }))
                            }
                            className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-xs outline-none focus:border-accent"
                          />
                        ) : (
                          formatAllocationPercent(stake.io_allocation)
                        )}
                      </td>
                      <td className={`${moneyCellClassName} px-4 py-3`}>
                        {isEditing ? (
                          <input
                            value={editForm.io_cash_value}
                            disabled={isBusy}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                io_cash_value: formatFinancialInput(event.target.value),
                              }))
                            }
                            className="w-32 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-xs outline-none focus:border-accent"
                          />
                        ) : (
                          formatFinancialAmount(stake.io_cash_value)
                        )}
                      </td>
                      <td className={`${moneyCellClassName} px-4 py-3`}>
                        {isEditing ? (
                          <input
                            value={editForm.deposit}
                            disabled={isBusy}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                deposit: formatFinancialInput(event.target.value),
                              }))
                            }
                            className="w-32 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-xs outline-none focus:border-accent"
                          />
                        ) : (
                          formatFinancialAmount(stake.deposit)
                        )}
                      </td>
                      <td className={`${moneyCellClassName} px-4 py-3`}>
                        {isEditing
                          ? Number.isFinite(editCashValue) &&
                            editCashValue > 0 &&
                            Number.isFinite(editDeposit)
                            ? formatDepositPct(editDeposit, editCashValue)
                            : "—"
                          : formatDepositPct(stake.deposit, stake.io_cash_value)}
                      </td>
                      <td className={`${moneyCellClassName} px-4 py-3`}>
                        {isEditing
                          ? Number.isFinite(editCashValue) && Number.isFinite(editDeposit)
                            ? formatFinancialAmount(computeAmountDue(editCashValue, editDeposit))
                            : "—"
                          : formatFinancialAmount(
                              computeAmountDue(stake.io_cash_value, stake.deposit),
                            )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void saveEdit(stake.id)}
                                disabled={isBusy}
                                aria-label="Save equity stake"
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
                                onClick={() => startEdit(stake)}
                                disabled={isBusy || editingId !== null}
                                aria-label="Edit equity stake"
                                title="Edit"
                                className={tableActionButtonClass.edit}
                              >
                                <PencilIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteStake(stake)}
                                disabled={isBusy || editingId !== null}
                                aria-label="Delete equity stake"
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
            {stakes.length > 0 ? (
              <tfoot>
                <tr className="border-t border-border bg-surface-elevated/60 font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className={`${moneyCellClassName} px-4 py-3`}>
                    {formatAllocationPercent(allocationTotal)}
                  </td>
                  <td className={`${moneyCellClassName} px-4 py-3`}>
                    {formatFinancialAmount(totals.ioCashValue)}
                  </td>
                  <td className={`${moneyCellClassName} px-4 py-3`}>
                    {formatFinancialAmount(totals.deposit)}
                  </td>
                  <td className={`${moneyCellClassName} px-4 py-3`}>
                    {totals.ioCashValue > 0
                      ? formatAllocationPercent(
                          computeDepositPct(totals.deposit, totals.ioCashValue) * 100,
                        )
                      : "—"}
                  </td>
                  <td className={`${moneyCellClassName} px-4 py-3`}>
                    {formatFinancialAmount(totals.amountDue)}
                  </td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>
    </div>
  );
}
