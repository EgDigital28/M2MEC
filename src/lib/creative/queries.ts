import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CREATIVE_BUCKET,
  type BrandKitVersion,
  type BrandKitWithVersion,
  type CreativeRender,
  type CreativeTemplate,
} from "@/lib/creative/types";

export const SIGNED_TTL = 3600;

export async function signedUrl(client: SupabaseClient, path: string | null) {
  if (!path) return null;
  const { data } = await client.storage.from(CREATIVE_BUCKET).createSignedUrl(path, SIGNED_TTL);
  return data?.signedUrl ?? null;
}

/** Bytes as a data URL, so the composer never depends on a network fetch. */
export async function dataUrl(client: SupabaseClient, path: string | null) {
  if (!path) return null;

  const { data, error } = await client.storage.from(CREATIVE_BUCKET).download(path);
  if (error || !data) return null;

  const buffer = Buffer.from(await data.arrayBuffer());
  const type = path.endsWith(".png") ? "image/png" : "image/jpeg";
  return `data:${type};base64,${buffer.toString("base64")}`;
}

/** Latest version per kit — what a new render uses unless told otherwise. */
export async function loadKitsWithVersions(client: SupabaseClient) {
  const [kits, versions] = await Promise.all([
    client.from("brand_kits").select("id, name, handle, is_active, created_at").order("created_at"),
    client
      .from("brand_kit_versions")
      .select("*")
      .order("version", { ascending: false }),
  ]);

  const latest = new Map<string, BrandKitVersion>();
  for (const version of (versions.data ?? []) as BrandKitVersion[]) {
    if (!latest.has(version.kit_id)) latest.set(version.kit_id, version);
  }

  return (kits.data ?? [])
    .map((kit) => ({ ...kit, version: latest.get(kit.id)! }))
    .filter((kit) => kit.version);
}

export async function loadTemplates(client: SupabaseClient) {
  const { data } = await client
    .from("creative_templates")
    .select("id, name, description, width, height, backdrop_prompt, slots, decorations, logo, is_active")
    .eq("is_active", true)
    .order("name");

  return (data ?? []) as unknown as CreativeTemplate[];
}

export type StudioKit = BrandKitWithVersion & { logoUrl: string | null };

export type CreativeBootstrap = {
  kits: StudioKit[];
  templates: CreativeTemplate[];
  renders: (CreativeRender & { url: string | null })[];
};

/** Everything the studio needs to render its first frame, in one round trip. */
export async function loadCreativeBootstrap(
  client: SupabaseClient,
  limit = 12,
): Promise<CreativeBootstrap> {
  const [kits, templates, renders] = await Promise.all([
    loadKitsWithVersions(client),
    loadTemplates(client),
    client
      .from("creative_renders")
      .select("id, template_id, kit_version_id, backdrop_id, slot_values, storage_path, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  if (renders.error) {
    throw new Error(renders.error.message);
  }

  const withUrls = await Promise.all(
    ((renders.data ?? []) as unknown as CreativeRender[]).map(async (render) => ({
      ...render,
      url: await signedUrl(client, render.storage_path),
    })),
  );

  const kitsWithLogos = await Promise.all(
    kits.map(async (kit) => ({ ...kit, logoUrl: await signedUrl(client, kit.version.logo_path) })),
  );

  return { kits: kitsWithLogos, templates, renders: withUrls };
}
