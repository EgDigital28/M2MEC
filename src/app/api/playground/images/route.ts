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
      storage_paths: paths,
      duration_ms: durationMs,
    })
    .select("id, model, prompt, aspect_ratio, resolution, media_type, storage_paths, duration_ms, created_at")
    .single();

  if (inserted.error) {
    console.error("playground.record_failed", inserted.error.message);
    return NextResponse.json(
      { error: "Images were stored but the generation could not be recorded." },
      { status: 502 },
    );
  }

  const [generation] = await withSignedUrls(db, [inserted.data as PlaygroundGenerationRow]);

  return NextResponse.json({ generation, warnings: generated.warnings, durationMs });
}
