import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { loadCreativeBootstrap } from "@/lib/creative/queries";
import { isHexColor } from "@/lib/creative/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function denied(error: "unauthenticated" | "forbidden") {
  return NextResponse.json(
    { error: error === "unauthenticated" ? "Sign in required." : "Admin access required." },
    { status: error === "unauthenticated" ? 401 : 403 },
  );
}

export async function GET() {
  const auth = await requireMinimumTier("admin");
  if ("error" in auth) return denied(auth.error);

  // Signing Storage URLs needs the service role; the bucket is private.
  try {
    return NextResponse.json(await loadCreativeBootstrap(createAdminClient()));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load creative data.";
    console.error("creative.bootstrap_failed", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireMinimumTier("admin");
  if ("error" in auth) return denied(auth.error);

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name || name.length > 120) {
    return NextResponse.json({ error: "Enter a kit name." }, { status: 400 });
  }

  for (const key of ["primary_color", "secondary_color", "accent_color", "text_color"]) {
    if (body[key] !== undefined && !isHexColor(body[key])) {
      return NextResponse.json({ error: `${key} must be a hex colour.` }, { status: 400 });
    }
  }

  const supabase = await createClient();
  const kit = await supabase
    .from("brand_kits")
    .insert({
      name,
      handle: typeof body.handle === "string" && body.handle.trim() ? body.handle.trim() : null,
      created_by: auth.profile.id,
    })
    .select("id, name, handle, is_active, created_at")
    .single();

  if (kit.error) {
    console.error("creative.kit_create_failed", kit.error.message);
    return NextResponse.json({ error: "Could not create the kit." }, { status: 500 });
  }

  const version = await supabase
    .from("brand_kit_versions")
    .insert({
      kit_id: kit.data.id,
      version: 1,
      ...(isHexColor(body.primary_color) ? { primary_color: body.primary_color } : {}),
      ...(isHexColor(body.secondary_color) ? { secondary_color: body.secondary_color } : {}),
      ...(isHexColor(body.accent_color) ? { accent_color: body.accent_color } : {}),
      ...(isHexColor(body.text_color) ? { text_color: body.text_color } : {}),
      style_prompt:
        typeof body.style_prompt === "string" && body.style_prompt.trim()
          ? body.style_prompt.trim().slice(0, 1000)
          : null,
    })
    .select("*")
    .single();

  if (version.error) {
    console.error("creative.kit_version_failed", version.error.message);
    return NextResponse.json({ error: "Could not create the kit version." }, { status: 500 });
  }

  return NextResponse.json({ kit: { ...kit.data, version: version.data } });
}
