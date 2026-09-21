import { notFound } from "next/navigation";
import { CreativeStudio } from "@/components/CreativeStudio";
import { TemplateStudio } from "@/components/TemplateStudio";
import { PlaygroundStudio } from "@/components/PlaygroundStudio";
import { PlaygroundTabs } from "@/components/PlaygroundTabs";
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
import {
  loadCreativeBootstrap,
  type CreativeBootstrap,
} from "@/lib/creative/queries";
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
  let creative: CreativeBootstrap = { kits: [], templates: [], renders: [] };
  let creativeError: string | null = null;

  // Signing Storage URLs needs the service role; both buckets are private.
  const db = createAdminClient();

  try {
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

  try {
    creative = await loadCreativeBootstrap(db);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    creativeError = /42P01|PGRST205/.test(message)
      ? "Brand kits are not set up yet. Run 032_creative_brand_kits.sql in Supabase."
      : "Brand kits could not be loaded.";
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-sm font-medium uppercase tracking-widest text-accent">Lab</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Image Playground</h1>
        <p className="mt-2 text-sm text-muted">
          Generate images through xAI, or compose a branded creative where only the backdrop is
          generated and every figure is drawn from real values. Results are stored privately.
        </p>
      </section>

      <PlaygroundTabs
        freeform={
          <PlaygroundStudio
            initialHistory={history}
            initialSpend={spend}
            defaultModel={defaultImageModelId()}
            configured={isImageProviderConfigured()}
            historyError={historyError}
          />
        }
        brand={<CreativeStudio {...creative} loadError={creativeError} />}
        templates={
          <TemplateStudio
            kits={creative.kits}
            templates={creative.templates}
            configured={isImageProviderConfigured()}
            defaultModel={defaultImageModelId()}
            loadError={creativeError}
          />
        }
      />
    </div>
  );
}
