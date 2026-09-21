import { NextResponse } from "next/server";
import { requireCreativeAdmin } from "@/lib/creative/auth";
import { signedUrl, TEMPLATE_COLUMNS } from "@/lib/creative/queries";
import { CREATIVE_BUCKET, type CreativeTemplate } from "@/lib/creative/types";
import {
  defaultImageModelId,
  extensionFor,
  generateImages,
  isImageModelId,
  isImageProviderConfigured,
} from "@/lib/playground/provider";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Generates the template's photograph. This is the only route in the creative
 * system that spends money, and it is reached from the template editor rather
 * than from making a post, so the cost lands where the decision is.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCreativeAdmin();
  if ("response" in auth) return auth.response;

  if (!isImageProviderConfigured()) {
    return NextResponse.json(
      { error: "XAI_API_KEY is not configured, so a backdrop cannot be generated." },
      { status: 503 },
    );
  }

  const { id } = await params;
  let body: { model?: string } = {};

  try {
    body = await request.json();
  } catch {
    // An empty body is fine; the default model is used.
  }

  const supabase = await createClient();
  const found = await supabase
    .from("creative_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  const template = found.data as unknown as CreativeTemplate | null;

  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  const model = isImageModelId(body.model) ? body.model : defaultImageModelId();
  // Portrait or landscape follows the template's own dimensions rather than a
  // setting, so the photograph cannot come back the wrong shape for the design.
  const aspectRatio = template.width === template.height
    ? "1:1"
    : template.width < template.height
      ? "2:3"
      : "3:2";

  let generated;

  try {
    generated = await generateImages({
      prompt: template.backdrop_prompt,
      count: 1,
      aspectRatio,
      resolution: "2k",
      model,
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

  const db = createAdminClient();
  const path = `backdrops/${template.id}/${crypto.randomUUID()}.${extensionFor(image.mediaType)}`;
  const upload = await db.storage
    .from(CREATIVE_BUCKET)
    .upload(path, image.bytes, { contentType: image.mediaType, upsert: false });

  if (upload.error) {
    console.error("creative.backdrop_upload_failed", upload.error.message);
    return NextResponse.json({ error: "Could not store the backdrop." }, { status: 502 });
  }

  const recorded = await db
    .from("creative_backdrops")
    .insert({
      template_id: template.id,
      prompt: template.backdrop_prompt,
      model: generated.model,
      storage_path: path,
      cost_in_usd_ticks: generated.costInUsdTicks,
    })
    .select("id, storage_path")
    .single();

  if (recorded.error) {
    console.error("creative.backdrop_record_failed", recorded.error.message);
    return NextResponse.json({ error: "Could not record the backdrop." }, { status: 502 });
  }

  // Previous backdrops are kept, so pointing the template back at an older one
  // stays possible and the spend history stays intact.
  const pointed = await supabase
    .from("creative_templates")
    .update({ backdrop_id: recorded.data.id })
    .eq("id", template.id)
    .select(TEMPLATE_COLUMNS)
    .single();

  if (pointed.error) {
    console.error("creative.backdrop_point_failed", pointed.error.message);
    return NextResponse.json({ error: "Could not attach the backdrop." }, { status: 500 });
  }

  return NextResponse.json({
    template: pointed.data,
    backdropUrl: await signedUrl(db, path),
    costInUsdTicks: generated.costInUsdTicks,
    warnings: generated.warnings,
  });
}
