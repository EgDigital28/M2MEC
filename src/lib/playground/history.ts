import type { SupabaseClient } from "@supabase/supabase-js";

export const PLAYGROUND_BUCKET = "playground-images";
export const SIGNED_URL_TTL_SECONDS = 3600;

export type PlaygroundGenerationRow = {
  id: string;
  model: string;
  prompt: string;
  aspect_ratio: string;
  resolution: string;
  media_type: string;
  storage_paths: string[];
  duration_ms: number | null;
  created_at: string;
};

export type PlaygroundGeneration = Omit<PlaygroundGenerationRow, "storage_paths"> & {
  images: { path: string; url: string }[];
};

export function isMissingPlaygroundTable(message: string | undefined) {
  return Boolean(message?.includes("playground_images"));
}

/**
 * The bucket is private, so every path is exchanged for a short-lived signed
 * URL. A path that fails to sign is dropped rather than rendering as a broken
 * image.
 */
export async function withSignedUrls(
  client: SupabaseClient,
  rows: PlaygroundGenerationRow[],
): Promise<PlaygroundGeneration[]> {
  return Promise.all(
    rows.map(async ({ storage_paths, ...row }) => {
      const { data } = await client.storage
        .from(PLAYGROUND_BUCKET)
        .createSignedUrls(storage_paths, SIGNED_URL_TTL_SECONDS);

      const images = (data ?? []).flatMap((signed) =>
        signed.path && signed.signedUrl
          ? [{ path: signed.path, url: signed.signedUrl }]
          : [],
      );

      return { ...row, images };
    }),
  );
}

export async function fetchPlaygroundHistory(client: SupabaseClient, limit = 12) {
  const { data, error } = await client
    .from("playground_images")
    .select("id, model, prompt, aspect_ratio, resolution, media_type, storage_paths, duration_ms, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return withSignedUrls(client, (data ?? []) as PlaygroundGenerationRow[]);
}
