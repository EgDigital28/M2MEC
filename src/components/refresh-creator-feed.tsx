"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
export function RefreshCreatorFeed() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button disabled={pending} onClick={() => startTransition(() => router.refresh())} className="ml-auto rounded-lg border border-border px-4 py-2 disabled:opacity-50">{pending ? "Refreshing…" : "Refresh"}</button>;
}
