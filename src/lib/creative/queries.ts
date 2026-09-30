import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CREATIVE_BUCKET,
  type BrandKitVersion,
  type BrandKitWithVersion,
  type CreativeRender,
  type CreativeTemplate,
} from "@/lib/creative/types";

export const SIGNED_TTL = 3600;

export const TEMPLATE_COLUMNS =
  "id, name, description, width, height, backdrop_prompt, slots, decorations, logo, backdrop_id, reference_path, is_active";

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
    .select(TEMPLATE_COLUMNS)
    .eq("is_active", true)
    .order("name");

  return (data ?? []) as unknown as CreativeTemplate[];
}

/** Storage path of the photograph a template is currently pointed at. */
export async function backdropPathFor(client: SupabaseClient, backdropId: string | null) {
  if (!backdropId) return null;

  const { data } = await client
    .from("creative_backdrops")
    .select("storage_path")
    .eq("id", backdropId)
    .maybeSingle();

  return data?.storage_path ?? null;
}

export type StudioKit = BrandKitWithVersion & { logoUrl: string | null };

/**
 * A template plus everything needed to show it without another round trip:
 * the last thing it produced (its thumbnail), the photograph it will use, and
 * any design it was authored against.
 */
export type StudioTemplate = CreativeTemplate & {
  previewUrl: string | null;
  backdropUrl: string | null;
  referenceUrl: string | null;
};

export type CreativeBootstrap = {
  kits: StudioKit[];
  templates: StudioTemplate[];
  renders: (CreativeRender & { url: string | null })[];
};

/** Everything the studio needs to render its first frame, in one round trip. */
export async function loadCreativeBootstrap(
  client: SupabaseClient,
  limit = 12,
): Promise<CreativeBootstrap> {
  const [kits, templates, renders, recent] = await Promise.all([
    loadKitsWithVersions(client),
    loadTemplates(client),
    client
      .from("creative_renders")
      .select("id, template_id, kit_version_id, backdrop_id, slot_values, storage_path, created_at")
      .order("created_at", { ascending: false })
      .limit(limit),
    // Two thin columns over a wider window than the gallery, so a template
    // that has not been used lately still shows what it looks like.
    client
      .from("creative_renders")
      .select("template_id, storage_path")
      .order("created_at", { ascending: false })
      .limit(200),
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

  const newest = new Map<string, string>();
  for (const row of (recent.data ?? []) as { template_id: string; storage_path: string }[]) {
    if (!newest.has(row.template_id)) newest.set(row.template_id, row.storage_path);
  }

  const backdropPaths = new Map<string, string>();
  const ids = templates.map((template) => template.backdrop_id).filter(Boolean) as string[];

  if (ids.length) {
    const { data } = await client
      .from("creative_backdrops")
      .select("id, storage_path")
      .in("id", ids);

    for (const row of (data ?? []) as { id: string; storage_path: string }[]) {
      backdropPaths.set(row.id, row.storage_path);
    }
  }

  const templatesWithPreviews = await Promise.all(
    templates.map(async (template) => {
      const [previewUrl, backdropUrl, referenceUrl] = await Promise.all([
        signedUrl(client, newest.get(template.id) ?? null),
        signedUrl(client, template.backdrop_id ? backdropPaths.get(template.backdrop_id) ?? null : null),
        signedUrl(client, template.reference_path),
      ]);

      return { ...template, previewUrl, backdropUrl, referenceUrl };
    }),
  );

  const kitsWithLogos = await Promise.all(
    kits.map(async (kit) => ({ ...kit, logoUrl: await signedUrl(client, kit.version.logo_path) })),
  );

  return { kits: kitsWithLogos, templates: templatesWithPreviews, renders: withUrls };
}
