"use client";

import { useState, type ReactNode } from "react";

type Tab = "freeform" | "brand";

const TABS: { id: Tab; label: string; note: string }[] = [
  { id: "freeform", label: "Freeform", note: "Prompt straight through to xAI." },
  { id: "brand", label: "Brand creative", note: "Generated backdrop, real values drawn on top." },
];

/**
 * The two halves are rendered on the server and handed in as elements, so
 * switching tabs never refetches and neither half pays for the other's data.
 */
export function PlaygroundTabs({ freeform, brand }: { freeform: ReactNode; brand: ReactNode }) {
  const [tab, setTab] = useState<Tab>("freeform");
  const active = TABS.find((entry) => entry.id === tab)!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            aria-pressed={tab === entry.id}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              tab === entry.id
                ? "bg-surface-elevated text-foreground"
                : "border border-border text-muted hover:text-foreground"
            }`}
          >
            {entry.label}
          </button>
        ))}
        <p className="text-xs text-muted">{active.note}</p>
      </div>

      <div hidden={tab !== "freeform"}>{freeform}</div>
      <div hidden={tab !== "brand"}>{brand}</div>
    </div>
  );
}
