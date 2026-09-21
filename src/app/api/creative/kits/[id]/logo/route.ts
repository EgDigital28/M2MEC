import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { signedUrl } from "@/lib/creative/queries";
import { CREATIVE_BUCKET, type BrandKitVersion } from "@/lib/creative/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;

// Satori draws the logo, and it only rasterises PNG and JPEG. Accepting an SVG
// here would upload cleanly and then fail at compose time.
const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

/** Uploading a logo is an edit, so like any other edit it writes a new version. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  const { id } = await params;

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  }

  const file = form.get("logo");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a logo file." }, { status: 400 });
  }

  const extension = TYPES[file.type];

  if (!extension) {
    return NextResponse.json({ error: "Upload a PNG or JPEG logo." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Keep the logo under 2 MB." }, { status: 400 });
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

  const previous = current.data as BrandKitVersion;
  const path = `logos/${id}/${crypto.randomUUID()}.${extension}`;
  const db = createAdminClient();

  const upload = await db.storage
    .from(CREATIVE_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });

  if (upload.error) {
    console.error("creative.logo_upload_failed", upload.error.message);
    return NextResponse.json({ error: "Could not store the logo." }, { status: 502 });
  }

  const version = await supabase
    .from("brand_kit_versions")
    .insert({
      kit_id: id,
      version: previous.version + 1,
      primary_color: previous.primary_color,
      secondary_color: previous.secondary_color,
      accent_color: previous.accent_color,
      text_color: previous.text_color,
      style_prompt: previous.style_prompt,
      logo_path: path,
    })
    .select("*")
    .single();

  if (version.error) {
    console.error("creative.logo_version_failed", version.error.message);
    return NextResponse.json({ error: "Could not save the new version." }, { status: 500 });
  }

  return NextResponse.json({
    version: version.data,
    logoUrl: await signedUrl(db, path),
  });
}
