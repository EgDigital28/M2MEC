import { NextResponse } from "next/server";
import { requireCreativeAdmin } from "@/lib/creative/auth";
import { TEMPLATE_COLUMNS } from "@/lib/creative/queries";
import { parseDecorations, parseRect, parseSlots } from "@/lib/creative/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCreativeAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name || name.length > 120) {
      return NextResponse.json({ error: "Enter a template name." }, { status: 400 });
    }
    patch.name = name;
  }

  if (typeof body.description === "string") {
    patch.description = body.description.trim() || null;
  }

  if (typeof body.backdrop_prompt === "string") {
    const prompt = body.backdrop_prompt.trim();
    if (!prompt) {
      return NextResponse.json({ error: "Enter a backdrop prompt." }, { status: 400 });
    }
    patch.backdrop_prompt = prompt.slice(0, 2000);
  }

  for (const key of ["width", "height"] as const) {
    if (body[key] !== undefined) {
      const size = Number(body[key]);
      if (!Number.isInteger(size) || size < 256 || size > 4096) {
        return NextResponse.json({ error: `${key} must be between 256 and 4096.` }, { status: 400 });
      }
      patch[key] = size;
    }
  }

  if (body.slots !== undefined) patch.slots = parseSlots(body.slots);
  if (body.decorations !== undefined) patch.decorations = parseDecorations(body.decorations);
  if (body.logo !== undefined) patch.logo = parseRect(body.logo);
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const supabase = await createClient();
  const updated = await supabase
    .from("creative_templates")
    .update(patch)
    .eq("id", id)
    .select(TEMPLATE_COLUMNS)
    .maybeSingle();

  if (updated.error) {
    const duplicate = updated.error.code === "23505";
    console.error("creative.template_update_failed", updated.error.message);
    return NextResponse.json(
      { error: duplicate ? "A template with that name already exists." : "Could not save the template." },
      { status: duplicate ? 409 : 500 },
    );
  }

  if (!updated.data) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  return NextResponse.json({ template: updated.data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCreativeAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const supabase = await createClient();
  const removed = await supabase.from("creative_templates").delete().eq("id", id);

  if (removed.error) {
    // creative_renders references the template with on delete restrict, so a
    // design that has produced posts cannot be deleted out from under them.
    const inUse = removed.error.code === "23503";
    console.error("creative.template_delete_failed", removed.error.message);
    return NextResponse.json(
      {
        error: inUse
          ? "This template has already produced creatives. Hide it instead of deleting it."
          : "Could not delete the template.",
      },
      { status: inUse ? 409 : 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
