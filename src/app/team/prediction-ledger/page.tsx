import Link from "next/link";
import { RefreshCreatorFeed } from "@/components/refresh-creator-feed";
import { notFound } from "next/navigation";
import { partnerLegLabel } from "@/lib/creator/protocol";
import { canViewCreatorFeed } from "@/lib/creator/access";
import { createClient } from "@/lib/supabase/server";

const text = (value: unknown) => typeof value === "string" ? value : "";
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
function time(value: unknown) {
  const date = new Date(text(value));
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(date) + " ET" : "—";
}

export default async function PredictionLedgerPage({ searchParams }: { searchParams: Promise<{ kind?: string; page?: string; entity?: string }> }) {
  if (!await canViewCreatorFeed()) notFound();
  const params = await searchParams;
  const kind = params.kind === "package" ? "package" : "pick";
  const page = Math.max(1, Math.min(10_000, Number.parseInt(params.page ?? "1", 10) || 1));
  const db = await createClient();
  let query = db.from("creator_partner_entities")
    .select("entity_id,entity_type,entity_version,record,received_at", { count: "exact" })
    .eq("entity_type", kind).order("received_at", { ascending: false }).order("entity_id")
    .range((page - 1) * 30, page * 30);
  if (params.entity && /^[0-9a-f-]{36}$/i.test(params.entity)) query = query.eq("entity_id", params.entity);
  const { data, error } = await query;
  return <div className="space-y-6">
    <div><p className="text-sm uppercase tracking-widest text-accent">Creator destination</p><h1 className="mt-3 text-3xl font-semibold">Prediction Ledger</h1>
      <p className="mt-3 text-muted">Creator plays, packages and verified grades from The Prediction Ledger. This view is private to your approved admin account.</p></div>
    <nav className="flex gap-2" aria-label="Prediction Ledger content">
      <Link className={`rounded-lg border px-4 py-2 ${kind === "pick" ? "border-accent text-accent" : "border-border"}`} href="?kind=pick">Plays</Link>
      <Link className={`rounded-lg border px-4 py-2 ${kind === "package" ? "border-accent text-accent" : "border-border"}`} href="?kind=package">Packages</Link>
      <RefreshCreatorFeed />
    </nav>
    {error ? <p role="alert" className="rounded-xl border border-red-400/30 p-5 text-red-300">The Creator feed could not be loaded. Refresh to try again.</p>
      : !data?.length ? <div className="rounded-2xl border border-border p-8"><h2 className="text-xl font-semibold">No {kind === "pick" ? "plays" : "packages"} received yet</h2><p className="mt-3 text-muted">Connect M2MEC in Creator, then select it when publishing. Delivered records and later status changes will appear here.</p></div>
      : <div className="grid gap-4">{data.slice(0, 30).map((row) => {
        const record = object(row.record);
        const creator = object(record.creator);
        const state = kind === "package" ? text(record.status) : record.publicationStatus !== "published" ? text(record.publicationStatus) : text(record.grade);
        const legs = Array.isArray(record.legs) ? record.legs.map(object) : [];
        const retired = ["withdrawn", "retracted", "corrected"].includes(state);
        return <article id={row.entity_id} key={row.entity_id} className={`rounded-2xl border border-border p-6 ${retired ? "opacity-70" : "bg-surface"}`}>
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted">{text(creator.displayName)} · {text(record.visibility)}</p><span className="rounded-full border border-border px-3 py-1 text-xs capitalize">{state.replaceAll("_", " ")}</span></div>
          <h2 className="mt-3 text-xl font-semibold">{text(record.headline)}</h2>
          {kind === "pick" ? <><p className="mt-2 text-sm">{String(record.units)}U · {record.oddsAmerican == null ? "Price unavailable" : `${Number(record.oddsAmerican) > 0 ? "+" : ""}${String(record.oddsAmerican)}`} · {text(record.pickType)}</p>
            <ol className="mt-4 grid gap-2">{legs.map((leg, index) => <li key={index} className="rounded-lg border border-border p-3"><p>{partnerLegLabel(leg)} · {text(leg.marketType).replaceAll("_", " ")}</p><p className="mt-1 text-sm text-muted">{text(leg.eventName)} · {time(leg.startsAt)}</p>{leg.grade ? <p className="mt-1 text-xs text-muted">Leg: {text(leg.grade)}</p> : null}</li>)}</ol>
          </> : <p className="mt-3 text-sm">{Array.isArray(record.pickIds) ? record.pickIds.length : 0} plays · {text(record.currency)} {(Number(record.priceCents) / 100).toFixed(2)} · {time(record.startsAt)} – {time(record.endsAt)}</p>}
          {kind === "package" && Array.isArray(record.pickIds) ? <ol className="mt-3 grid gap-2 text-sm">{record.pickIds.map((id, index) => <li key={String(id)}><Link href={`?kind=pick&entity=${encodeURIComponent(String(id))}`} className="text-accent underline">View play {index + 1} and its current grade</Link></li>)}</ol> : null}
          {record.analysis ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{text(record.analysis)}</p> : null}
          {record.reason ? <p className="mt-4 text-sm text-muted">Reason: {text(record.reason)}</p> : null}
          {record.replacementCreatorPickId ? <Link className="mt-3 block text-sm text-accent underline" href={`?kind=pick&entity=${encodeURIComponent(text(record.replacementCreatorPickId))}`}>View replacement play</Link> : null}
          <div className="mt-5 flex flex-wrap gap-4 text-xs text-muted"><a href={text(creator.profileUrl)} target="_blank" rel="noreferrer" className="text-accent underline">Creator profile</a><span>Published {time(record.publishedAt)}</span><span>Synced {time(row.received_at)}</span><span>Revision {row.entity_version}</span></div>
          <details className="mt-4 text-xs text-muted"><summary className="cursor-pointer">Source receipt</summary><p className="mt-2 break-all">Creator ID: {text(creator.id)} · Receipt: {row.entity_id}{record.ledgerPickId ? ` · Ledger: ${text(record.ledgerPickId)}` : ""}</p></details>
        </article>;
      })}</div>}
    <div className="flex justify-between text-sm">{page > 1 ? <Link href={`?kind=${kind}&page=${page - 1}`}>← Previous</Link> : <span/>}{data && data.length > 30 ? <Link href={`?kind=${kind}&page=${page + 1}`}>Next →</Link> : null}</div>
  </div>;
}
