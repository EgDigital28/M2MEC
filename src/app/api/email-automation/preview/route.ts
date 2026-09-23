import { NextResponse } from "next/server";
import { requireMinimumTier } from "@/lib/auth/profile";
import { getTodayDateString } from "@/lib/bets/calculations";
import { buildTodaysPlaysDigests } from "@/lib/bets/todays-plays-digest";
import { AUTOMATED_RECIPIENTS } from "@/lib/email/automation";
import { todaysPlaysHtml, todaysPlaysSubject } from "@/lib/email/todays-plays";
import { escapeHtml } from "@/lib/email/utils";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Shows the today's plays email the next check would send this person, built
 * from the same code as the real send. Nothing is sent and nothing is logged.
 */
export async function GET(request: Request) {
  const auth = await requireMinimumTier("admin");

  if ("error" in auth) {
    return NextResponse.json(
      { error: auth.error === "unauthenticated" ? "Sign in required." : "Admin access required." },
      { status: auth.error === "unauthenticated" ? 401 : 403 },
    );
  }

  // A position in the recipient list rather than an address, so no email
  // address ends up in a URL or a server log, and the preview can only ever
  // show someone who is actually on the list.
  const index = Number(new URL(request.url).searchParams.get("recipient"));
  const recipient = Number.isInteger(index) ? AUTOMATED_RECIPIENTS[index] : undefined;

  if (!recipient) {
    return NextResponse.json({ error: "Unknown recipient." }, { status: 400 });
  }

  const today = getTodayDateString();
  const [digest] = await buildTodaysPlaysDigests(createAdminClient(), [recipient], today);
  const params = { sentOnDate: today, ...digest };

  const banner = digest.shouldSend
    ? `Preview only — nothing has been sent. The next check would send this to ${recipient} with the subject “${todaysPlaysSubject(params)}”.`
    : `Preview only. Nothing new has arrived since ${recipient}'s last email today, so the next check would send nothing. This is what the email would look like.`;

  const page = todaysPlaysHtml(params).replace(
    /<body([^>]*)>/i,
    `<body$1><div style="font-family:system-ui,sans-serif;font-size:13px;padding:12px 16px;background:#fbbf24;color:#1c1917;">${escapeHtml(banner)}</div>`,
  );

  return new NextResponse(page, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
