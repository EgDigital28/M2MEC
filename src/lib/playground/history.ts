import type { SupabaseClient } from "@supabase/supabase-js";

export const PLAYGROUND_BUCKET = "playground-images";
export const SIGNED_URL_TTL_SECONDS = 3600;

export type PlaygroundImageRow = {
  position: number;
  storage_path: string;
  cost_in_usd_ticks: number | null;
};

export type PlaygroundGenerationRow = {
  id: string;
  model: string;
  prompt: string;
  aspect_ratio: string;
  resolution: string;
  media_type: string;
  duration_ms: number | null;
  cost_in_usd_ticks: number | null;
  created_at: string;
  playground_image_files: PlaygroundImageRow[] | null;
};

export type PlaygroundImage = {
  path: string;
  url: string;
  costInUsdTicks: number | null;
};

export type PlaygroundGeneration = Omit<PlaygroundGenerationRow, "playground_image_files"> & {
  images: PlaygroundImage[];
};

/** Measured cost per image for one model + resolution pair. */
export type CostRate = {
  model: string;
  resolution: string;
  ticksPerImage: number;
  sampleImages: number;
};

export type SpendSummary = {
  totalTicks: number;
  todayTicks: number;
  imageCount: number;
  rates: CostRate[];
};

const GENERATION_COLUMNS =
  "id, model, prompt, aspect_ratio, resolution, media_type, duration_ms, cost_in_usd_ticks, created_at, playground_image_files (position, storage_path, cost_in_usd_ticks)";

export function isMissingPlaygroundTable(message: string | undefined) {
  return Boolean(message?.includes("playground_image"));
}

/**
 * The bucket is private, so every path is exchanged for a short-lived signed
 * URL. A path that fails to sign is dropped rather than rendering broken.
 */
export async function withSignedUrls(
  client: SupabaseClient,
  rows: PlaygroundGenerationRow[],
): Promise<PlaygroundGeneration[]> {
  return Promise.all(
    rows.map(async ({ playground_image_files, ...row }) => {
      const files = [...(playground_image_files ?? [])].sort((a, b) => a.position - b.position);
      const { data } = await client.storage
        .from(PLAYGROUND_BUCKET)
        .createSignedUrls(
          files.map((file) => file.storage_path),
          SIGNED_URL_TTL_SECONDS,
        );

      const urlByPath = new Map(
        (data ?? []).flatMap((signed) =>
          signed.path && signed.signedUrl ? [[signed.path, signed.signedUrl] as const] : [],
        ),
      );

      const images = files.flatMap((file) => {
        const url = urlByPath.get(file.storage_path);
        return url
          ? [{ path: file.storage_path, url, costInUsdTicks: file.cost_in_usd_ticks }]
          : [];
      });

      return { ...row, images };
    }),
  );
}

export async function fetchPlaygroundHistory(client: SupabaseClient, limit = 12) {
  const { data, error } = await client
    .from("playground_images")
    .select(GENERATION_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return withSignedUrls(client, (data ?? []) as unknown as PlaygroundGenerationRow[]);
}

/**
 * Spend totals plus a measured per-image rate for each model + resolution.
 * The estimate shown before generating comes from what this account actually
 * paid, so there is no hardcoded price list to go stale.
 */
export async function fetchSpendSummary(
  client: SupabaseClient,
  todayIso: string,
): Promise<SpendSummary> {
  const { data, error } = await client
    .from("playground_image_files")
    .select("cost_in_usd_ticks, created_at, playground_images!inner (model, resolution)")
    .not("cost_in_usd_ticks", "is", null);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as unknown as {
    cost_in_usd_ticks: number;
    created_at: string;
    playground_images: { model: string; resolution: string } | null;
  }[];

  const buckets = new Map<string, { ticks: number; images: number }>();
  let totalTicks = 0;
  let todayTicks = 0;

  for (const row of rows) {
    totalTicks += row.cost_in_usd_ticks;

    if (row.created_at >= todayIso) {
      todayTicks += row.cost_in_usd_ticks;
    }

    const parent = row.playground_images;
    if (!parent) continue;

    const key = `${parent.model}|${parent.resolution}`;
    const bucket = buckets.get(key) ?? { ticks: 0, images: 0 };
    bucket.ticks += row.cost_in_usd_ticks;
    bucket.images += 1;
    buckets.set(key, bucket);
  }

  const rates = [...buckets.entries()].map(([key, bucket]) => {
    const [model, resolution] = key.split("|");
    return {
      model,
      resolution,
      ticksPerImage: bucket.ticks / bucket.images,
      sampleImages: bucket.images,
    };
  });

  return { totalTicks, todayTicks, imageCount: rows.length, rates };
}

/** Midnight Eastern today, as a UTC ISO instant, for "spent today" totals. */
export function startOfTodayIso(timeZone = "America/New_York") {
  const now = new Date();
  const localNow = new Date(now.toLocaleString("en-US", { timeZone }));
  const localMidnight = new Date(localNow);
  localMidnight.setHours(0, 0, 0, 0);

  return new Date(localMidnight.getTime() + (now.getTime() - localNow.getTime())).toISOString();
}
