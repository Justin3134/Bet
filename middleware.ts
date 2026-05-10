import { NextRequest, NextResponse } from "next/server";

const PROTECTED_ROUTES = ["/dashboard", "/bet/new", "/onboarding"];

export default function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Always allow OAuth callbacks through — the insforge_code in the URL must
  // reach the client-side SDK so it can exchange the code for a session.
  if (searchParams.has("insforge_code") || searchParams.has("insforge_status")) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isProtected) {
    // The SDK sets insforge_csrf_token as a non-httpOnly cookie once the user
    // is authenticated. Use it as a lightweight proxy for "has session".
    const hasSession = req.cookies.has("insforge_csrf_token");
    if (!hasSession) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.url);
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
