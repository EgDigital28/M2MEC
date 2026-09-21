import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PLAYGROUND_BUCKET,
  withSignedUrls,
  type PlaygroundGenerationRow,
} from "@/lib/playground/history";
import {
  extensionFor,
  generateImages,
  isAspectRatio,
  isImageModelId,
  isImageProviderConfigured,
  isResolution,
  MAX_IMAGES,
  MAX_PROMPT_LENGTH,
} from "@/lib/playground/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type GeneratePayload = {
  prompt?: unknown;
  count?: unknown;
  aspectRatio?: unknown;
  resolution?: unknown;
  model?: unknown;
};

export async function POST(request: Request) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  if (!isImageProviderConfigured()) {
    return NextResponse.json(
      { error: "XAI_API_KEY is not configured on this deployment." },
      { status: 503 },
    );
  }

  let body: GeneratePayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const count = Number(body.count);

  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `Enter a prompt of 1 to ${MAX_PROMPT_LENGTH} characters.` },
      { status: 400 },
    );
  }

  if (!Number.isInteger(count) || count < 1 || count > MAX_IMAGES) {
    return NextResponse.json(
      { error: `Choose between 1 and ${MAX_IMAGES} images.` },
      { status: 400 },
    );
  }

  if (!isAspectRatio(body.aspectRatio) || !isResolution(body.resolution)) {
    return NextResponse.json({ error: "Unsupported aspect ratio or resolution." }, { status: 400 });
  }

  if (!isImageModelId(body.model)) {
    return NextResponse.json({ error: "Unsupported model." }, { status: 400 });
  }

  const startedAt = Date.now();
  let generated;

  try {
    generated = await generateImages({
      prompt,
      count,
      aspectRatio: body.aspectRatio,
      resolution: body.resolution,
      model: body.model,
    });
  } catch (error) {
    // Provider errors carry the actionable detail (billing, unknown model,
    // content refusal), so pass the message through rather than flattening it.
    const message = error instanceof Error ? error.message : "Image generation failed.";
    console.error("playground.generate_failed", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const durationMs = Date.now() - startedAt;

  if (generated.images.length === 0) {
    return NextResponse.json({ error: "The provider returned no images." }, { status: 502 });
  }

  const db = createAdminClient();
  const generationId = crypto.randomUUID();
  const mediaType = generated.images[0].mediaType;
  const extension = extensionFor(mediaType);
  const paths: string[] = [];

  for (const [index, image] of generated.images.entries()) {
    const path = `${auth.profile.id}/${generationId}/${index}.${extension}`;
    const upload = await db.storage
      .from(PLAYGROUND_BUCKET)
      .upload(path, image.bytes, { contentType: image.mediaType, upsert: false });

    if (upload.error) {
      console.error("playground.upload_failed", upload.error.message);
      return NextResponse.json(
        { error: "Images were generated but could not be stored." },
        { status: 502 },
      );
    }

    paths.push(path);
  }

  // The provider prices the call; split it evenly so each image carries its
  // own share. Remainder ticks land on the first image so the parts still sum
  // to exactly what was charged.
  const totalTicks = generated.costInUsdTicks;
  const perImage =
    totalTicks == null ? null : Math.floor(totalTicks / generated.images.length);
  const remainder =
    totalTicks == null || perImage == null ? 0 : totalTicks - perImage * generated.images.length;

  const inserted = await db
    .from("playground_images")
    .insert({
      id: generationId,
      created_by: auth.profile.id,
      provider: generated.provider,
      model: generated.model,
      prompt,
      aspect_ratio: body.aspectRatio,
      resolution: body.resolution,
      media_type: mediaType,
      duration_ms: durationMs,
      cost_in_usd_ticks: totalTicks,
    })
    .select("id")
    .single();

  if (inserted.error) {
    console.error("playground.record_failed", inserted.error.message);
    return NextResponse.json(
      { error: "Images were stored but the generation could not be recorded." },
      { status: 502 },
    );
  }

  const files = await db.from("playground_image_files").insert(
    paths.map((path, index) => ({
      generation_id: generationId,
      position: index,
      storage_path: path,
      cost_in_usd_ticks: perImage == null ? null : perImage + (index === 0 ? remainder : 0),
    })),
  );

  if (files.error) {
    console.error("playground.record_files_failed", files.error.message);
    return NextResponse.json(
      { error: "Images were stored but could not be recorded." },
      { status: 502 },
    );
  }

  const reread = await db
    .from("playground_images")
    .select(
      "id, model, prompt, aspect_ratio, resolution, media_type, duration_ms, cost_in_usd_ticks, created_at, playground_image_files (position, storage_path, cost_in_usd_ticks)",
    )
    .eq("id", generationId)
    .single();

  if (reread.error) {
    console.error("playground.reread_failed", reread.error.message);
    return NextResponse.json({ error: "Could not load the new generation." }, { status: 502 });
  }

  const [generation] = await withSignedUrls(db, [reread.data as unknown as PlaygroundGenerationRow]);

  return NextResponse.json({ generation, warnings: generated.warnings, durationMs });
}
