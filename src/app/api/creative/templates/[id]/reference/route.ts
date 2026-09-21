import { NextResponse } from "next/server";
import { requireCreativeAdmin } from "@/lib/creative/auth";
import { signedUrl } from "@/lib/creative/queries";
import { CREATIVE_BUCKET } from "@/lib/creative/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Stores a design the template is being authored against.
 *
 * Nothing reads this image: the provider's image endpoint takes a text prompt
 * only, and it silently ignores an image field rather than conditioning on it.
 * It is here so the reference sits beside the layout while you tune it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCreativeAdmin();
  if ("response" in auth) return auth.response;

  const { id } = await params;
  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = form.get("reference");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a reference image." }, { status: 400 });
  }

  const extension = TYPES[file.type];

  if (!extension) {
    return NextResponse.json({ error: "Upload a PNG, JPEG or WebP image." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Keep the reference under 8 MB." }, { status: 400 });
  }

  const db = createAdminClient();
  const path = `references/${id}/${crypto.randomUUID()}.${extension}`;
  const upload = await db.storage
    .from(CREATIVE_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });

  if (upload.error) {
    console.error("creative.reference_upload_failed", upload.error.message);
    return NextResponse.json({ error: "Could not store the reference." }, { status: 502 });
  }

  const supabase = await createClient();
  const updated = await supabase
    .from("creative_templates")
    .update({ reference_path: path })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (updated.error || !updated.data) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  return NextResponse.json({ referenceUrl: await signedUrl(db, path) });
}
