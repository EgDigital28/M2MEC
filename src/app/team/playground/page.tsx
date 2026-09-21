import { notFound } from "next/navigation";
import { PlaygroundStudio } from "@/components/PlaygroundStudio";
import { requireMinimumTier } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchPlaygroundHistory,
  fetchSpendSummary,
  isMissingPlaygroundTable,
  startOfTodayIso,
  type PlaygroundGeneration,
  type SpendSummary,
} from "@/lib/playground/history";
import { defaultImageModelId, isImageProviderConfigured } from "@/lib/playground/provider";

export const dynamic = "force-dynamic";

export default async function PlaygroundPage() {
  const auth = await requireMinimumTier("admin");

  // Admin-only, and invisible rather than forbidden to everyone else.
  if ("error" in auth) {
    notFound();
  }

  let history: PlaygroundGeneration[] = [];
  let spend: SpendSummary = { totalTicks: 0, todayTicks: 0, imageCount: 0, rates: [] };
  let historyError: string | null = null;

  try {
    // Signing Storage URLs needs the service role; the bucket is private.
    const db = createAdminClient();
    [history, spend] = await Promise.all([
      fetchPlaygroundHistory(db),
      fetchSpendSummary(db, startOfTodayIso()),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    historyError = isMissingPlaygroundTable(message)
      ? "History is not set up yet. Run 020_playground_images.sql in Supabase."
      : "Past generations could not be loaded.";
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">Lab</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Image Playground</h1>
        <p className="mt-2 text-sm text-muted">
          Generate images through xAI. Results are stored privately and kept here so a prompt can
          be compared across models.
        </p>
      </section>

      <PlaygroundStudio
        initialHistory={history}
        initialSpend={spend}
        defaultModel={defaultImageModelId()}
        configured={isImageProviderConfigured()}
        historyError={historyError}
      />
    </div>
  );
}
