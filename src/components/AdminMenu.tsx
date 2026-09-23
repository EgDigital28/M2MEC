"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** Settings pages that do not earn a place in the main navigation. */
const ADMIN_LINKS = [{ label: "Email automation", href: "/team/email-automation" }];

/**
 * The name in the header, opened as a menu for admins. On small screens the
 * name is hidden, so the tier badge is the trigger instead.
 */
export function AdminMenu({ name, tierLabel }: { name: string; tierLabel: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium transition-colors hover:text-foreground"
      >
        <span className="hidden sm:inline">
          {name} <span className="text-muted">({tierLabel})</span>
        </span>
        <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent sm:hidden">
          {tierLabel}
        </span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className={`h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 min-w-48 rounded-xl border border-border bg-surface-elevated p-1 shadow-lg"
        >
          {ADMIN_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
