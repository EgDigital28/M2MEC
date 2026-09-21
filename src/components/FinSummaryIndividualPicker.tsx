"use client";

import { useState } from "react";

type Person = { id: string; label: string };

export function FinSummaryIndividualPicker({ people }: { people: Person[] }) {
  const [selected, setSelected] = useState("");

  const choices = people.filter((person) => person.id);

  return (
    <section className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-5 print:hidden">
      <label className="min-w-[220px] flex-1 sm:max-w-xs">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Individual
        </span>
        <select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent"
        >
          <option value="">Select…</option>
          {choices.map((person) => (
            <option key={person.id} value={person.id}>
              {person.label}
            </option>
          ))}
        </select>
      </label>

      {/* Opened in a new tab so the full summary stays on screen behind it. */}
      <a
        href={selected ? `/team/fin-summary/${selected}` : undefined}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!selected}
        onClick={(event) => {
          if (!selected) event.preventDefault();
        }}
        className={`h-11 rounded-full px-5 text-sm font-semibold leading-[2.75rem] ${
          selected
            ? "bg-foreground text-background"
            : "pointer-events-none bg-foreground/40 text-background/60"
        }`}
      >
        Generate individual summary
      </a>
    </section>
  );
}
