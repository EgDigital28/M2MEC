import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { isHexColor } from "@/lib/creative/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Editing a kit writes a new version rather than mutating the old one, so a
 * render made last month still resolves the colours it was made with.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  const { id } = await params;
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  for (const key of ["primary_color", "secondary_color", "accent_color", "text_color"]) {
    if (body[key] !== undefined && !isHexColor(body[key])) {
      return NextResponse.json({ error: `${key} must be a hex colour.` }, { status: 400 });
    }
  }

  const supabase = await createClient();

  const current = await supabase
    .from("brand_kit_versions")
    .select("*")
    .eq("kit_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (current.error || !current.data) {
    return NextResponse.json({ error: "Kit not found." }, { status: 404 });
  }

  if (typeof body.name === "string" && body.name.trim()) {
    await supabase
      .from("brand_kits")
      .update({
        name: body.name.trim(),
        handle:
          typeof body.handle === "string" && body.handle.trim() ? body.handle.trim() : null,
      })
      .eq("id", id);
  }

  const version = await supabase
    .from("brand_kit_versions")
    .insert({
      kit_id: id,
      version: current.data.version + 1,
      primary_color: isHexColor(body.primary_color)
        ? body.primary_color
        : current.data.primary_color,
      secondary_color: isHexColor(body.secondary_color)
        ? body.secondary_color
        : current.data.secondary_color,
      accent_color: isHexColor(body.accent_color)
        ? body.accent_color
        : current.data.accent_color,
      text_color: isHexColor(body.text_color) ? body.text_color : current.data.text_color,
      logo_path: current.data.logo_path,
      style_prompt:
        typeof body.style_prompt === "string"
          ? body.style_prompt.trim().slice(0, 1000) || null
          : current.data.style_prompt,
    })
    .select("*")
    .single();

  if (version.error) {
    console.error("creative.kit_version_failed", version.error.message);
    return NextResponse.json({ error: "Could not save the new version." }, { status: 500 });
  }

  return NextResponse.json({ version: version.data });
}
