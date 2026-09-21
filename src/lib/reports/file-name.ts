/**
 * Plain module, deliberately not a client one: both report pages are server
 * components, and a function exported from a "use client" file cannot be
 * called from the server — only rendered or passed as a prop.
 */

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
