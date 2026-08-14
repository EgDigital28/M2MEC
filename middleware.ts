import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function redirectAuthCode(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const type = searchParams.get("type");

  if (!code || pathname.startsWith("/auth/callback")) {
    return null;
  }

  const url = request.nextUrl.clone();
  url.pathname = "/auth/callback";
  url.searchParams.set("next", "/set-password?reason=recovery");
  url.searchParams.delete("type");

  if (type) {
    url.searchParams.set("type", type);
  }

  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const authRedirect = redirectAuthCode(request);
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
