import { NextResponse } from "next/server";
import { requireCreativeAdmin } from "@/lib/creative/auth";
import { TEMPLATE_COLUMNS } from "@/lib/creative/queries";
import type { CreativeTemplate } from "@/lib/creative/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Creates a template, optionally as a copy of an existing one.
 *
 * Copying is the normal way to make a second design: it starts from a layout
 * that already works rather than from an empty canvas, and crucially it
 * leaves the original alone — editing a template in place destroys the design
 * it replaces, which is a mistake worth making hard to repeat.
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

  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!name || name.length > 120) {
    return NextResponse.json({ error: "Enter a template name." }, { status: 400 });
  }

  const supabase = await createClient();
  let source: CreativeTemplate | null = null;

  if (typeof body.copyFromId === "string" && body.copyFromId) {
    const found = await supabase
      .from("creative_templates")
      .select(TEMPLATE_COLUMNS)
      .eq("id", body.copyFromId)
      .maybeSingle();

    source = (found.data as unknown as CreativeTemplate | null) ?? null;

    if (!source) {
      return NextResponse.json({ error: "The template to copy was not found." }, { status: 404 });
    }
  }

  const created = await supabase
    .from("creative_templates")
    .insert({
      name,
      description: source?.description ?? null,
      width: source?.width ?? 1080,
      height: source?.height ?? 1350,
      backdrop_prompt:
        source?.backdrop_prompt ??
        "A blank surface, centred, against a dark out-of-focus background. Photographic, no text, no lettering, no numbers, no markings of any kind.",
      slots: source?.slots ?? [],
      decorations: source?.decorations ?? [],
      logo: source?.logo ?? null,
      // Deliberately not copied: the copy starts without a photograph, so
      // generating one is a visible, costed decision rather than a surprise.
      backdrop_id: null,
      reference_path: source?.reference_path ?? null,
      created_by: auth.profile.id,
    })
    .select(TEMPLATE_COLUMNS)
    .single();

  if (created.error) {
    const duplicate = created.error.code === "23505";
    console.error("creative.template_create_failed", created.error.message);
    return NextResponse.json(
      { error: duplicate ? "A template with that name already exists." : "Could not create the template." },
      { status: duplicate ? 409 : 500 },
    );
  }

  return NextResponse.json({ template: created.data });
}
