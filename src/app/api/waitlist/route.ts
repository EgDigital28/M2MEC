import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  waitlistWelcomeHtml,
  waitlistWelcomeSubject,
  waitlistWelcomeText,
} from "@/lib/email/waitlist-welcome";

type WaitlistPayload = {
  name?: string;
  email?: string;
  message?: string;
};

export async function POST(request: Request) {
  let body: WaitlistPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const message = body.message?.trim();

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "Name, email, and message are required." },
      { status: 400 },
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("waitlist_submissions")
    .select("id, welcome_email_sent_at")
    .ilike("email", email)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("waitlist_submissions")
      .update({ name, message })
      .eq("id", existing.id);
  } else {
    const { error: insertError } = await supabase
      .from("waitlist_submissions")
      .insert({ name, email, message, status: "pending" });

    if (insertError) {
      console.error("Waitlist insert failed:", insertError);
      return NextResponse.json(
        { error: "Could not save your submission. Please try again." },
        { status: 500 },
      );
    }
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "M2MEC <noreply@m2mec.com>";

  if (!resendApiKey) {
    console.error("RESEND_API_KEY is not configured");
    return NextResponse.json(
      { error: "Email service is not configured." },
      { status: 500 },
    );
  }

  const resend = new Resend(resendApiKey);
  const { error: emailError } = await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: waitlistWelcomeSubject(),
    html: waitlistWelcomeHtml({ name }),
    text: waitlistWelcomeText({ name }),
  });

  if (emailError) {
    console.error("Waitlist welcome email failed:", emailError);
    return NextResponse.json(
      { error: "Saved, but we could not send a confirmation email." },
      { status: 502 },
    );
  }

  await supabase
    .from("waitlist_submissions")
    .update({ status: "welcomed", welcome_email_sent_at: now })
    .ilike("email", email);

  return NextResponse.json({ ok: true });
}
