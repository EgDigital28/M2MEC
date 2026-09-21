"use client";

import { useEffect } from "react";

/**
 * Browsers take the suggested PDF filename from document.title, so the title
 * is swapped for the duration of the print and restored afterwards.
 */
export function PrintReportButton({
  fileName,
  label = "Download PDF",
}: {
  fileName: string;
  label?: string;
}) {
  useEffect(() => {
    const original = document.title;
    const restore = () => {
      document.title = original;
    };

    window.addEventListener("afterprint", restore);
    return () => {
      window.removeEventListener("afterprint", restore);
      restore();
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        document.title = fileName;
        window.print();
      }}
      className="h-11 rounded-full border border-border px-5 text-sm font-medium transition-colors hover:border-accent/40 print:hidden"
    >
      {label}
    </button>
  );
}

/** m2mec_sam_bennet_fin_2026-09-21 */
export function reportFileName(name: string, date = new Date()) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(date);

  return `m2mec_${slug || "report"}_fin_${day}`;
}
