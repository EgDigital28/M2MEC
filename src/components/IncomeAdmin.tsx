"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  computeOverallPl,
  formatCurrencyWhole,
  withComputedFields,
  type BetEntryRow,
} from "@/lib/bets/calculations";
import {
  formatContractDate,
  formatIncomeAmount,
  recognitionSchedule,
  sumEarnedToDate,
  sumRecognizedForYear,
  type IncomeContract,
} from "@/lib/financials/income";

const emptyForm = () => ({
  name: "",
  counterparty: "",
  annual_amount: "",
  start_date: "",
  end_date: "",
});

export function IncomeAdmin() {
  const [contracts, setContracts] = useState<IncomeContract[]>([]);
  const [poolValue, setPoolValue] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [incomeResponse, betsResponse] = await Promise.all([
        fetch("/api/financials/income"),
        fetch("/api/bets"),
      ]);

      const incomeData = (await incomeResponse.json()) as {
        contracts?: IncomeContract[];
        error?: string;
      };

      if (!incomeResponse.ok) {
        setError(incomeData.error ?? "Could not load income contracts.");
      } else {
        setContracts(incomeData.contracts ?? []);
        setError(null);
      }

      // The pool figure is the ledger balance, so income can be shown both
      // included and excluded without changing how the pool itself is stored.
      if (betsResponse.ok) {
        const betsData = (await betsResponse.json()) as { entries?: BetEntryRow[] };
        const totalPl = (betsData.entries ?? [])
          .map((row) => withComputedFields(row))
          .reduce((sum, entry) => sum + entry.profit_loss, 0);
        setPoolValue(computeOverallPl(totalPl));
      }
    } catch {
      setError("Network error while loading income.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentYear = new Date().getUTCFullYear();
  const earnedToDate = useMemo(() => sumEarnedToDate(contracts), [contracts]);
  const thisYear = useMemo(
    () => sumRecognizedForYear(contracts, currentYear),
    [contracts, currentYear],
  );
  const nextYear = useMemo(
    () => sumRecognizedForYear(contracts, currentYear + 1),
    [contracts, currentYear],
  );

  async function createContract(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/financials/income", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          counterparty: form.counterparty || null,
          annual_amount: Number(form.annual_amount.replace(/[,$]/g, "")),
          start_date: form.start_date,
          end_date: form.end_date || null,
        }),
      });

      const data = (await response.json()) as { contract?: IncomeContract; error?: string };

      if (!response.ok || !data.contract) {
        setError(data.error ?? "Could not add the contract.");
        return;
      }

      setContracts((current) => [...current, data.contract!]);
      setForm(emptyForm());
    } catch {
      setError("Network error while adding the contract.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete the ${name} contract? Recognised income will drop accordingly.`)) {
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(`/api/financials/income/${id}`, { method: "DELETE" });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Could not delete the contract.");
        return;
      }

      setContracts((current) => current.filter((contract) => contract.id !== id));
    } catch {
      setError("Network error while deleting the contract.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="income" className="space-y-4">
      <div>
        <h2 id="income" className="text-xl font-semibold">
          Income
        </h2>
        <p className="mt-2 text-sm text-muted">
          Annual contracts, recognised daily across calendar years. A contract starting mid-year
          is prorated for that year and recognises in full thereafter.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Earned to date
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums">
            {formatIncomeAmount(earnedToDate)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            {currentYear} recognised
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums">
            {formatIncomeAmount(thisYear)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            {currentYear + 1} contracted
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums">
            {formatIncomeAmount(nextYear)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Pool + earned income
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums">
            {poolValue == null ? "—" : formatCurrencyWhole(poolValue + earnedToDate)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {poolValue == null ? "Pool unavailable" : `Pool alone ${formatCurrencyWhole(poolValue)}`}
          </p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-400/30 p-4 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={createContract}
        className="grid gap-3 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2 lg:grid-cols-6"
      >
        <label className="lg:col-span-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Name
          </span>
          <input
            required
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="ESPN"
            className="mt-2 w-full rounded-lg border border-border bg-background p-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <label>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Annual amount
          </span>
          <input
            required
            inputMode="decimal"
            value={form.annual_amount}
            onChange={(event) => setForm({ ...form, annual_amount: event.target.value })}
            placeholder="400000"
            className="mt-2 w-full rounded-lg border border-border bg-background p-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <label>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            Start date
          </span>
          <input
            required
            type="date"
            value={form.start_date}
            onChange={(event) => setForm({ ...form, start_date: event.target.value })}
            className="mt-2 w-full rounded-lg border border-border bg-background p-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <label>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
            End date
          </span>
          <input
            type="date"
            value={form.end_date}
            onChange={(event) => setForm({ ...form, end_date: event.target.value })}
            className="mt-2 w-full rounded-lg border border-border bg-background p-2.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="mt-auto rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50"
        >
          Add contract
        </button>
        <p className="text-xs text-muted sm:col-span-2 lg:col-span-6">
          Leave the end date blank for a contract that continues indefinitely.
        </p>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Contract</th>
              <th className="px-4 py-3 font-medium">Term</th>
              <th className="px-4 py-3 text-right font-medium">Annual</th>
              <th className="px-4 py-3 font-medium">Recognition by year</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Loading income...
                </td>
              </tr>
            ) : contracts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No income contracts yet.
                </td>
              </tr>
            ) : (
              contracts.map((contract) => (
                <tr key={contract.id} className="border-b border-border/60 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{contract.name}</p>
                    {contract.counterparty && contract.counterparty !== contract.name ? (
                      <p className="text-xs text-muted">{contract.counterparty}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatContractDate(contract.start_date)} —{" "}
                    {contract.end_date ? formatContractDate(contract.end_date) : "ongoing"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatIncomeAmount(Number(contract.annual_amount))}
                  </td>
                  <td className="px-4 py-3">
                    <ul className="space-y-1">
                      {recognitionSchedule(contract, currentYear + 1).map((year) => (
                        <li key={year.year} className="tabular-nums">
                          <span className="text-muted">{year.year}:</span>{" "}
                          {formatIncomeAmount(year.amount)}
                          {year.prorated ? (
                            <span className="ml-2 text-xs text-muted">
                              prorated {year.activeDays}/{year.daysInYear} days
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove(contract.id, contract.name)}
                      disabled={busy}
                      className="text-xs text-red-300 hover:text-red-200 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
