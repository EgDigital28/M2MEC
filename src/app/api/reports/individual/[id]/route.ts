import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { buildIndividualPdf } from "@/lib/reports/individual-pdf-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  const { id } = await params;
  let pdf;

  try {
    pdf = await buildIndividualPdf(id);
  } catch (error) {
    // A render failure used to return an empty body, which looked like a blank
    // page rather than an error. Say what happened.
    const message = error instanceof Error ? error.message : "PDF rendering failed.";
    console.error("reports.individual.render_failed", message);
    return NextResponse.json({ error: `Could not render the PDF: ${message}` }, { status: 500 });
  }

  if (!pdf) {
    return NextResponse.json({ error: "Person not found." }, { status: 404 });
  }

  return new Response(new Uint8Array(pdf.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdf.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
