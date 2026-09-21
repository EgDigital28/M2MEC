"use client";

export function PrintReportButton({ label = "Download PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-11 rounded-full border border-border px-5 text-sm font-medium transition-colors hover:border-accent/40 print:hidden"
    >
      {label}
    </button>
  );
}
