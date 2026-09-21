import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { composeCreative } from "@/lib/creative/compose";
import { dataUrl, signedUrl } from "@/lib/creative/queries";
import {
  CREATIVE_BUCKET,
  type BrandKitVersion,
  type CreativeTemplate,
} from "@/lib/creative/types";
import {
  defaultImageModelId,
  extensionFor,
  generateImages,
  isImageProviderConfigured,
} from "@/lib/playground/provider";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  let body: {
    templateId?: string;
    kitVersionId?: string;
    values?: Record<string, string>;
    regenerateBackdrop?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const supabase = await createClient();

  const [templateResult, versionResult] = await Promise.all([
    supabase
      .from("creative_templates")
      .select("id, name, description, width, height, backdrop_prompt, slots, is_active")
      .eq("id", body.templateId ?? "")
      .maybeSingle(),
    supabase
      .from("brand_kit_versions")
      .select("*")
      .eq("id", body.kitVersionId ?? "")
      .maybeSingle(),
  ]);

  const template = templateResult.data as unknown as CreativeTemplate | null;
  const version = versionResult.data as BrandKitVersion | null;

  if (!template || !version) {
    return NextResponse.json({ error: "Pick a template and a brand kit." }, { status: 400 });
  }

  const db = createAdminClient();

  // Reuse the cached backdrop unless asked for a new one. This is the only
  // step that costs money, so it must not be the default.
  let backdrop = body.regenerateBackdrop
    ? null
    : (
        await db
          .from("creative_backdrops")
          .select("id, storage_path")
          .eq("kit_version_id", version.id)
          .eq("template_id", template.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data;

  if (!backdrop) {
    if (!isImageProviderConfigured()) {
      return NextResponse.json(
        { error: "XAI_API_KEY is not configured, so a backdrop cannot be generated." },
        { status: 503 },
      );
    }

    const prompt = [template.backdrop_prompt, version.style_prompt].filter(Boolean).join(" ");

    let generated;

    try {
      generated = await generateImages({
        prompt,
        count: 1,
        aspectRatio: "2:3",
        resolution: "2k",
        model: defaultImageModelId(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Backdrop generation failed.";
      console.error("creative.backdrop_failed", message);
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const image = generated.images[0];

    if (!image) {
      return NextResponse.json({ error: "No backdrop was returned." }, { status: 502 });
    }

    const path = `backdrops/${version.id}/${template.id}/${crypto.randomUUID()}.${extensionFor(image.mediaType)}`;
    const upload = await db.storage
      .from(CREATIVE_BUCKET)
      .upload(path, image.bytes, { contentType: image.mediaType, upsert: false });

    if (upload.error) {
      console.error("creative.backdrop_upload_failed", upload.error.message);
      return NextResponse.json({ error: "Could not store the backdrop." }, { status: 502 });
    }

    const inserted = await db
      .from("creative_backdrops")
      .insert({
        kit_version_id: version.id,
        template_id: template.id,
        prompt,
        model: generated.model,
        storage_path: path,
        cost_in_usd_ticks: generated.costInUsdTicks,
      })
      .select("id, storage_path")
      .single();

    if (inserted.error) {
      console.error("creative.backdrop_record_failed", inserted.error.message);
      return NextResponse.json({ error: "Could not record the backdrop." }, { status: 502 });
    }

    backdrop = inserted.data;
  }

  const [backdropData, logoData] = await Promise.all([
    dataUrl(db, backdrop.storage_path),
    dataUrl(db, version.logo_path),
  ]);

  let png: Buffer;

  try {
    png = await composeCreative({
      template,
      version,
      values: body.values ?? {},
      backdropDataUrl: backdropData,
      logoDataUrl: logoData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Compose failed.";
    console.error("creative.compose_failed", message);
    return NextResponse.json({ error: `Could not compose the image: ${message}` }, { status: 500 });
  }

  const renderPath = `renders/${version.id}/${crypto.randomUUID()}.png`;
  const stored = await db.storage
    .from(CREATIVE_BUCKET)
    .upload(renderPath, png, { contentType: "image/png", upsert: false });

  if (stored.error) {
    console.error("creative.render_upload_failed", stored.error.message);
    return NextResponse.json({ error: "Could not store the render." }, { status: 502 });
  }

  const record = await db
    .from("creative_renders")
    .insert({
      template_id: template.id,
      kit_version_id: version.id,
      backdrop_id: backdrop.id,
      slot_values: body.values ?? {},
      storage_path: renderPath,
      created_by: auth.profile.id,
    })
    .select("id, template_id, kit_version_id, backdrop_id, slot_values, storage_path, created_at")
    .single();

  if (record.error) {
    console.error("creative.render_record_failed", record.error.message);
    return NextResponse.json({ error: "Could not record the render." }, { status: 502 });
  }

  return NextResponse.json({
    render: { ...record.data, url: await signedUrl(db, renderPath) },
  });
}
