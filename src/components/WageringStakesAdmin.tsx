"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckIcon,
  PencilIcon,
  tableActionButtonClass,
  TrashIcon,
  XIcon,
} from "@/components/TableActionIcons";
import { LEDGER_STARTING_BALANCE } from "@/lib/bets/calculations";
import {
  formatAllocationPercent,
  formatFinancialAmount,
  formatFinancialInput,
  investorDisplayLabel,
  parseFinancialAmount,
  reportAliasForStake,
  stakeholderLabel,
  UNALLOCATED_INVESTOR_LABEL,
  type EquityStakeholder,
} from "@/lib/financials/types";
import {
  computeOwnershipPct,
  computeWageringStakeValue,
  formatGroupId,
  sortWageringGroups,
  sumCapitalDeposits,
  wageringGroupLabel,
  type WageringStake,
  type WageringStakeGroup,
} from "@/lib/financials/wagering";

type WageringForm = {
  profile_id: string;
  group_id: string;
  capital_deposit: string;
};

type GroupForm = {
  name: string;
  description: string;
  sort_order: string;
};

const formFieldClassName =
  "h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-accent";

const moneyCellClassName = "whitespace-nowrap text-right font-mono tabular-nums";

const emptyWageringForm = (): WageringForm => ({
  profile_id: "",
  group_id: "",
  capital_deposit: "",
});

const emptyGroupForm = (): GroupForm => ({
  name: "",
  description: "",
  sort_order: "0",
});

function getGroup(stake: WageringStake, groups: WageringStakeGroup[]) {
  const joined = stake.group;
  if (joined && !Array.isArray(joined)) {
    return joined;
  }

  return groups.find((group) => group.id === stake.group_id) ?? null;
}

function availableStakeholdersForGroup(
  stakeholders: EquityStakeholder[],
  stakes: WageringStake[],
  groupId: string,
  currentProfileId = "",
) {
  if (!groupId) {
    return stakeholders;
  }

  const assigned = new Set(
    stakes
      .filter((stake) => stake.group_id === groupId && stake.profile_id)
      .map((stake) => stake.profile_id as string),
  );

  return stakeholders.filter(
    (stakeholder) => !assigned.has(stakeholder.id) || stakeholder.id === currentProfileId,
  );
}

export function WageringStakesAdmin() {
  const [stakes, setStakes] = useState<WageringStake[]>([]);
  const [groups, setGroups] = useState<WageringStakeGroup[]>([]);
  const [stakeholders, setStakeholders] = useState<EquityStakeholder[]>([]);
  const [overallPl, setOverallPl] = useState(0);
  const [totalProfitLoss, setTotalProfitLoss] = useState(0);
  const [form, setForm] = useState<WageringForm>(emptyWageringForm);
  const [editForm, setEditForm] = useState<WageringForm>(emptyWageringForm);
  const [groupForm, setGroupForm] = useState<GroupForm>(emptyGroupForm);
  const [groupEditForm, setGroupEditForm] = useState<GroupForm>(emptyGroupForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [migrationRequired, setMigrationRequired] = useState(false);

  const activeGroups = useMemo(
    () => sortWageringGroups(groups.filter((group) => group.is_active)),
    [groups],
  );

  const totalCapitalDeposits = useMemo(() => sumCapitalDeposits(stakes), [stakes]);

  const previewDeposit = parseFinancialAmount(form.capital_deposit);
  const previewOwnership =
    Number.isFinite(previewDeposit) && totalCapitalDeposits + previewDeposit > 0
      ? formatAllocationPercent(
          computeOwnershipPct(previewDeposit, totalCapitalDeposits + previewDeposit),
        )
      : totalCapitalDeposits > 0 && Number.isFinite(previewDeposit)
        ? formatAllocationPercent(computeOwnershipPct(previewDeposit, totalCapitalDeposits))
        : "—";
  const previewValue =
    Number.isFinite(previewDeposit) && totalCapitalDeposits + previewDeposit > 0
      ? formatFinancialAmount(
          computeWageringStakeValue(
            computeOwnershipPct(previewDeposit, totalCapitalDeposits + previewDeposit),
            overallPl,
          ),
        )
      : "—";

  const totalValue = useMemo(() => computeWageringStakeValue(100, overallPl), [overallPl]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMigrationRequired(false);

    try {
      const [stakesRes, groupsRes, stakeholdersRes] = await Promise.all([
        fetch("/api/financials/wagering-stakes"),
        fetch("/api/financials/wagering-groups"),
        fetch("/api/financials/stakeholders"),
      ]);

      const stakesData = (await stakesRes.json()) as {
        stakes?: WageringStake[];
        overallPl?: number;
        totalProfitLoss?: number;
        error?: string;
      };
      const groupsData = (await groupsRes.json()) as {
        groups?: WageringStakeGroup[];
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

      if (!groupsRes.ok) {
        if (groupsRes.status === 503) {
          setMigrationRequired(true);
        } else {
          setError(groupsData.error ?? "Could not load wagering groups.");
          setLoading(false);
          return;
        }
      }

      if (!stakesRes.ok && stakesRes.status !== 503) {
        setError(stakesData.error ?? "Could not load wagering stakes.");
        setLoading(false);
        return;
      }

      setStakeholders(stakeholdersData.stakeholders ?? []);
      setGroups(groupsData.groups ?? []);
      setStakes(stakesData.stakes ?? []);
      setOverallPl(stakesData.overallPl ?? LEDGER_STARTING_BALANCE);
      setTotalProfitLoss(stakesData.totalProfitLoss ?? 0);
    } catch {
      setError("Network error while loading wagering stakes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingGroup(true);
    setError(null);

    try {
      const response = await fetch("/api/financials/wagering-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupForm.name.trim(),
          description: groupForm.description.trim() || null,
          sort_order: Number(groupForm.sort_order) || 0,
        }),
      });

      const data = (await response.json()) as { group?: WageringStakeGroup; error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not create group.");
        setCreatingGroup(false);
        return;
      }

      if (data.group) {
        setGroups((current) => sortWageringGroups([...current, data.group!]));
      }

      setGroupForm(emptyGroupForm());
    } catch {
      setError("Network error while creating group.");
    } finally {
      setCreatingGroup(false);
    }
  }

  function startEditGroup(group: WageringStakeGroup) {
    setEditingGroupId(group.id);
    setGroupEditForm({
      name: group.name,
      description: group.description ?? "",
      sort_order: String(group.sort_order),
    });
  }

  function cancelEditGroup() {
    setEditingGroupId(null);
    setGroupEditForm(emptyGroupForm());
  }

  async function saveGroup(groupId: string) {
    setBusyId(groupId);
    setError(null);

    try {
      const response = await fetch(`/api/financials/wagering-groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupEditForm.name.trim(),
          description: groupEditForm.description.trim() || null,
          sort_order: Number(groupEditForm.sort_order) || 0,
        }),
      });

      const data = (await response.json()) as { group?: WageringStakeGroup; error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not update group.");
        setBusyId(null);
        return;
      }

      if (data.group) {
        setGroups((current) =>
          sortWageringGroups(current.map((group) => (group.id === groupId ? data.group! : group))),
        );
      }

      cancelEditGroup();
    } catch {
      setError("Network error while updating group.");
    } finally {
      setBusyId(null);
    }
  }

  async function archiveGroup(group: WageringStakeGroup) {
    const confirmed = window.confirm(
      group.is_active
        ? `Archive "${group.name}"? It will be hidden from new dropdowns.`
        : `Restore "${group.name}" to active dropdowns?`,
    );

    if (!confirmed) {
      return;
    }

    setBusyId(group.id);
    setError(null);

    try {
      const response = await fetch(`/api/financials/wagering-groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !group.is_active }),
      });

      const data = (await response.json()) as { group?: WageringStakeGroup; error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not update group.");
        setBusyId(null);
        return;
      }

      if (data.group) {
        setGroups((current) =>
          sortWageringGroups(
            current.map((item) => (item.id === group.id ? data.group! : item)),
          ),
        );
      }
    } catch {
      setError("Network error while updating group.");
    } finally {
      setBusyId(null);
    }
  }

  async function createStake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyId("new-wagering-stake");
    setError(null);

    const capitalDeposit = parseFinancialAmount(form.capital_deposit);

    if (!form.group_id || !Number.isFinite(capitalDeposit) || capitalDeposit < 0) {
      setError("Enter a valid group and capital deposit.");
      setBusyId(null);
      return;
    }

    try {
      const response = await fetch("/api/financials/wagering-stakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: form.profile_id || null,
          group_id: form.group_id,
          capital_deposit: capitalDeposit,
        }),
      });

      const data = (await response.json()) as { stake?: WageringStake; error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not add wagering stake.");
        setBusyId(null);
        return;
      }

      if (data.stake) {
        setStakes((current) => [...current, data.stake!]);
      }

      setForm(emptyWageringForm());
    } catch {
      setError("Network error while adding wagering stake.");
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(stake: WageringStake) {
    setEditingId(stake.id);
    setEditForm({
      profile_id: stake.profile_id ?? "",
      group_id: stake.group_id,
      capital_deposit: formatFinancialInput(String(Math.round(stake.capital_deposit))),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyWageringForm());
  }

  async function saveEdit(stakeId: string) {
    const capitalDeposit = parseFinancialAmount(editForm.capital_deposit);

    if (!editForm.group_id || !Number.isFinite(capitalDeposit) || capitalDeposit < 0) {
      setError("Enter a valid group and capital deposit.");
      return;
    }

    setBusyId(stakeId);
    setError(null);

    try {
      const response = await fetch(`/api/financials/wagering-stakes/${stakeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: editForm.profile_id || null,
          group_id: editForm.group_id,
          capital_deposit: capitalDeposit,
        }),
      });

      const data = (await response.json()) as { stake?: WageringStake; error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not update wagering stake.");
        setBusyId(null);
        return;
      }

      if (data.stake) {
        setStakes((current) => current.map((stake) => (stake.id === stakeId ? data.stake! : stake)));
      }

      cancelEdit();
    } catch {
      setError("Network error while updating wagering stake.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteStake(stake: WageringStake) {
    const name = investorDisplayLabel(stake, stakeholders);

    if (!window.confirm(`Delete wagering stake for ${name}?`)) {
      return;
    }

    if (editingId === stake.id) {
      cancelEdit();
    }

    setBusyId(stake.id);
    setError(null);

    try {
      const response = await fetch(`/api/financials/wagering-stakes/${stake.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not delete wagering stake.");
        setBusyId(null);
        return;
      }

      setStakes((current) => current.filter((row) => row.id !== stake.id));
    } catch {
      setError("Network error while deleting wagering stake.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {migrationRequired && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Run <code className="text-foreground">017_wagering_stakes.sql</code> in Supabase to
          enable wagering stake tracking.
        </p>
      )}

      <section className="rounded-2xl border border-border bg-surface-elevated p-5">
        <h2 className="text-lg font-semibold">Wagering groups</h2>
        <p className="mt-1 text-sm text-muted">
          Configure group ID, name, and description for wagering stake assignments.
        </p>

        <form onSubmit={createGroup} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={groupForm.name}
            onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Group name"
            required
            className={formFieldClassName}
          />
          <input
            value={groupForm.description}
            onChange={(event) =>
              setGroupForm((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Description"
            className={formFieldClassName}
          />
          <input
            value={groupForm.sort_order}
            onChange={(event) =>
              setGroupForm((current) => ({ ...current, sort_order: event.target.value }))
            }
            type="number"
            placeholder="Order"
            className={formFieldClassName}
          />
          <button
            type="submit"
            disabled={creatingGroup}
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {creatingGroup ? "Adding..." : "Add group"}
          </button>
        </form>

        <div className="mt-4 space-y-2">
          {groups.length === 0 ? (
            <p className="text-sm text-muted">No groups yet.</p>
          ) : (
            sortWageringGroups(groups).map((group) => {
              const isEditing = editingGroupId === group.id;
              const isBusy = busyId === group.id;

              return (
                <div
                  key={group.id}
                  className={`flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 ${
                    group.is_active
                      ? "border-border/60"
                      : "border-border/40 bg-surface/40 opacity-80"
                  }`}
                >
                  <p className="w-24 font-mono text-xs text-muted">{formatGroupId(group.id)}</p>
                  {isEditing ? (
                    <>
                      <input
                        value={groupEditForm.name}
                        disabled={isBusy}
                        onChange={(event) =>
                          setGroupEditForm((current) => ({ ...current, name: event.target.value }))
                        }
                        className="min-w-[140px] flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
                      />
                      <input
                        value={groupEditForm.description}
                        disabled={isBusy}
                        onChange={(event) =>
                          setGroupEditForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        placeholder="Description"
                        className="min-w-[180px] flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
                      />
                      <input
                        value={groupEditForm.sort_order}
                        disabled={isBusy}
                        type="number"
                        onChange={(event) =>
                          setGroupEditForm((current) => ({
                            ...current,
                            sort_order: event.target.value,
                          }))
                        }
                        className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
                      />
                    </>
                  ) : (
                    <>
                      <p className="min-w-[140px] flex-1 text-sm font-medium">{group.name}</p>
                      <p className="min-w-[180px] flex-1 text-sm text-muted">
                        {group.description?.trim() || "—"}
                      </p>
                      <p className="w-20 text-sm text-muted">Order {group.sort_order}</p>
                    </>
                  )}
                  <div className="ml-auto flex gap-1">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void saveGroup(group.id)}
                          disabled={isBusy}
                          aria-label="Save group"
                          title="Save"
                          className={tableActionButtonClass.save}
                        >
                          <CheckIcon />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditGroup}
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
                          onClick={() => startEditGroup(group)}
                          disabled={isBusy || editingGroupId !== null}
                          aria-label="Edit group"
                          title="Edit"
                          className={tableActionButtonClass.edit}
                        >
                          <PencilIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => void archiveGroup(group)}
                          disabled={isBusy || editingGroupId !== null}
                          className="rounded-full border border-border px-3 py-1.5 text-[11px] font-medium transition-colors hover:border-accent/40 disabled:opacity-60"
                        >
                          {group.is_active ? "Archive" : "Restore"}
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

      <section className="rounded-2xl border border-border bg-surface-elevated p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Wagering stake</h2>
            <p className="mt-1 text-sm text-muted">
              Assign capital deposits by investor and group. Ownership % is based on total capital
              deposits; value uses overall P/L.
            </p>
          </div>
          <p className="text-sm text-muted">
            Overall P/L:{" "}
            <span className="font-medium text-foreground">{formatFinancialAmount(overallPl)}</span>
            <span className="ml-2 text-xs">
              ({formatFinancialAmount(totalProfitLoss)} net · starting{" "}
              {formatFinancialAmount(LEDGER_STARTING_BALANCE)})
            </span>
          </p>
        </div>

        <form onSubmit={createStake} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select
            value={form.profile_id}
            onChange={(event) =>
              setForm((current) => ({ ...current, profile_id: event.target.value }))
            }
            className={formFieldClassName}
          >
            <option value="">{UNALLOCATED_INVESTOR_LABEL}</option>
            {availableStakeholdersForGroup(stakeholders, stakes, form.group_id).map(
              (stakeholder) => (
                <option key={stakeholder.id} value={stakeholder.id}>
                  {stakeholderLabel(stakeholder)}
                </option>
              ),
            )}
          </select>

          <select
            value={form.group_id}
            onChange={(event) =>
              setForm((current) => ({ ...current, group_id: event.target.value }))
            }
            required
            className={formFieldClassName}
          >
            <option value="" disabled>
              Group
            </option>
            {activeGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {wageringGroupLabel(group)}
              </option>
            ))}
          </select>

          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
              $
            </span>
            <input
              value={form.capital_deposit}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  capital_deposit: formatFinancialInput(event.target.value),
                }))
              }
              inputMode="numeric"
              placeholder="Capital deposit"
              required
              className={`${formFieldClassName} pl-7`}
            />
          </div>

          <div className={`flex items-center ${formFieldClassName} text-muted`}>
            Ownership %: <span className="ml-2 font-medium text-foreground">{previewOwnership}</span>
          </div>

          <div className={`flex items-center ${formFieldClassName} text-muted`}>
            Value: <span className="ml-2 font-medium text-foreground">{previewValue}</span>
          </div>

          <div className="md:col-span-2 xl:col-span-2">
            <button
              type="submit"
              disabled={busyId === "new-wagering-stake" || activeGroups.length === 0}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busyId === "new-wagering-stake" ? "Adding..." : "Add wagering stake"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border">
        <div className="overflow-x-auto">
          <table className="min-w-[1080px] w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-elevated text-left text-muted">
                <th className="px-4 py-3 font-medium">Investor</th>
                <th className="px-4 py-3 font-medium">Report Alias</th>
                <th className="px-4 py-3 font-medium">Group</th>
                <th className="px-4 py-3 text-right font-medium">Capital Deposit</th>
                <th className="px-4 py-3 text-right font-medium">Ownership %</th>
                <th className="px-4 py-3 text-right font-medium">Value</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    Loading wagering stakes...
                  </td>
                </tr>
              ) : stakes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    No wagering stakes yet.
                  </td>
                </tr>
              ) : (
                stakes.map((stake) => {
                  const isEditing = editingId === stake.id;
                  const isBusy = busyId === stake.id;
                  const ownershipPct = computeOwnershipPct(
                    stake.capital_deposit,
                    totalCapitalDeposits,
                  );
                  const value = computeWageringStakeValue(ownershipPct, overallPl);
                  const editDeposit = parseFinancialAmount(editForm.capital_deposit);
                  const editTotal =
                    totalCapitalDeposits -
                    stake.capital_deposit +
                    (Number.isFinite(editDeposit) ? editDeposit : 0);
                  const group = getGroup(stake, groups);

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
                            <option value="">{UNALLOCATED_INVESTOR_LABEL}</option>
                            {availableStakeholdersForGroup(
                              stakeholders,
                              stakes.filter((row) => row.id !== stake.id),
                              editForm.group_id,
                              stake.profile_id ?? "",
                            ).map((item) => (
                              <option key={item.id} value={item.id}>
                                {stakeholderLabel(item)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          investorDisplayLabel(stake, stakeholders)
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {reportAliasForStake(stake, stakeholders) ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={editForm.group_id}
                            disabled={isBusy}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                group_id: event.target.value,
                              }))
                            }
                            className="w-full min-w-[160px] rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
                          >
                            {activeGroups.map((item) => (
                              <option key={item.id} value={item.id}>
                                {wageringGroupLabel(item)}
                              </option>
                            ))}
                          </select>
                        ) : group ? (
                          wageringGroupLabel(group)
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className={`${moneyCellClassName} px-4 py-3`}>
                        {isEditing ? (
                          <input
                            value={editForm.capital_deposit}
                            disabled={isBusy}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                capital_deposit: formatFinancialInput(event.target.value),
                              }))
                            }
                            className="w-32 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-xs outline-none focus:border-accent"
                          />
                        ) : (
                          formatFinancialAmount(stake.capital_deposit)
                        )}
                      </td>
                      <td className={`${moneyCellClassName} px-4 py-3`}>
                        {isEditing
                          ? Number.isFinite(editDeposit) && editTotal > 0
                            ? formatAllocationPercent(computeOwnershipPct(editDeposit, editTotal))
                            : "—"
                          : formatAllocationPercent(ownershipPct)}
                      </td>
                      <td className={`${moneyCellClassName} px-4 py-3`}>
                        {isEditing
                          ? Number.isFinite(editDeposit) && editTotal > 0
                            ? formatFinancialAmount(
                                computeWageringStakeValue(
                                  computeOwnershipPct(editDeposit, editTotal),
                                  overallPl,
                                ),
                              )
                            : "—"
                          : formatFinancialAmount(value)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void saveEdit(stake.id)}
                                disabled={isBusy}
                                aria-label="Save wagering stake"
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
                                aria-label="Edit wagering stake"
                                title="Edit"
                                className={tableActionButtonClass.edit}
                              >
                                <PencilIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteStake(stake)}
                                disabled={isBusy || editingId !== null}
                                aria-label="Delete wagering stake"
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
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className={`${moneyCellClassName} px-4 py-3`}>
                    {formatFinancialAmount(totalCapitalDeposits)}
                  </td>
                  <td className={`${moneyCellClassName} px-4 py-3`}>
                    {totalCapitalDeposits > 0 ? formatAllocationPercent(100) : "—"}
                  </td>
                  <td className={`${moneyCellClassName} px-4 py-3`}>
                    {formatFinancialAmount(totalValue)}
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
