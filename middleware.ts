import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function redirectAuthCallback(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");

  if ((!code && !tokenHash) || pathname.startsWith("/auth/callback")) {
    return null;
  }

  const url = request.nextUrl.clone();
  url.pathname = "/auth/callback";

  if (!url.searchParams.has("next")) {
    const type = searchParams.get("type");
    url.searchParams.set(
      "next",
      type === "recovery" ? "/set-password?reason=recovery" : "/set-password",
    );
  }

  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const authRedirect = redirectAuthCallback(request);
  if (authRedirect) {
    return authRedirect;
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
