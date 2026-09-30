import { NextResponse } from "next/server";
import { composeCreative } from "@/lib/creative/compose";
import { requireCreativeAdmin } from "@/lib/creative/auth";
import { backdropPathFor, dataUrl } from "@/lib/creative/queries";
import {
  parseDecorations,
  parseRect,
  parseSlots,
  type BrandKitVersion,
  type CreativeTemplate,
} from "@/lib/creative/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Composes a template without storing anything.
 *
 * Nothing here is generated, so a preview is free and can run on every edit —
 * which is what makes tuning a layout against a backdrop practical at all.
 */
export async function POST(request: Request) {
  const auth = await requireCreativeAdmin();
  if ("response" in auth) return auth.response;

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const db = createAdminClient();

  const [templateResult, versionResult] = await Promise.all([
    db
      .from("creative_templates")
      .select("id, name, width, height, backdrop_id, slots, decorations, logo")
      .eq("id", typeof body.templateId === "string" ? body.templateId : "")
      .maybeSingle(),
    db
      .from("brand_kit_versions")
      .select("*")
      .eq("id", typeof body.kitVersionId === "string" ? body.kitVersionId : "")
      .maybeSingle(),
  ]);

  const stored = templateResult.data as unknown as CreativeTemplate | null;
  const version = versionResult.data as BrandKitVersion | null;

  if (!stored || !version) {
    return NextResponse.json({ error: "Pick a template and a brand kit." }, { status: 400 });
  }

  // Unsaved edits win, so the preview shows what you are looking at rather
  // than what is currently stored.
  const template: CreativeTemplate = {
    ...stored,
    slots: body.slots === undefined ? stored.slots : parseSlots(body.slots),
    decorations:
      body.decorations === undefined ? stored.decorations : parseDecorations(body.decorations),
    logo: body.logo === undefined ? stored.logo : parseRect(body.logo),
  };

  const values =
    body.values && typeof body.values === "object"
      ? (body.values as Record<string, string>)
      : Object.fromEntries(
          template.slots.filter((slot) => slot.placeholder).map((s) => [s.key, s.placeholder!]),
        );

  const [backdropData, logoData] = await Promise.all([
    dataUrl(db, await backdropPathFor(db, template.backdrop_id)),
    dataUrl(db, version.logo_path),
  ]);

  try {
    const png = await composeCreative({
      template,
      version,
      values,
      backdropDataUrl: backdropData,
      logoDataUrl: logoData,
    });

    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Compose failed.";
    console.error("creative.preview_failed", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
