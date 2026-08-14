import { createServerClient } from "@supabase/ssr";
import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

function safeNextPath(next: string | null) {
  if (next?.startsWith("/") && !next.startsWith("//")) {
    return next;
  }

  return "/set-password";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  if (!code && !(tokenHash && type)) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const response = NextResponse.redirect(new URL(next, origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Invite/recovery links must replace any existing session (e.g. admin testing an invite).
  await supabase.auth.signOut();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return response;
    }

    console.error("Auth callback code exchange failed:", error.message);
  }

  if (tokenHash && type) {
    const otpType = (type === "signup" ? "invite" : type) as EmailOtpType;
    const { error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });

    if (!error) {
      return response;
    }

    console.error("Auth callback OTP verify failed:", error.message, { type, otpType });
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
