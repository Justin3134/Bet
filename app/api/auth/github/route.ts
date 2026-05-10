import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import crypto from "crypto";

const INSFORGE_URL =
  process.env.NEXT_PUBLIC_INSFORGE_URL || "https://4vxtn8fe.us-east.insforge.app";

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Require an active session
  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionClient = createClient({
    baseUrl: INSFORGE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || "",
    headers: { Cookie: cookieHeader },
  });

  const { data: sessionData } = await sessionClient.auth.getCurrentUser();
  if (!sessionData?.user) {
    return NextResponse.redirect(`${baseUrl}/sign-in`);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(`${baseUrl}/onboarding?github_error=config`);
  }

  // Generate a random CSRF state token
  const state = crypto.randomBytes(16).toString("hex");
  const callbackUrl = `${baseUrl}/api/auth/github/callback`;

  const githubAuthUrl = new URL("https://github.com/login/oauth/authorize");
  githubAuthUrl.searchParams.set("client_id", clientId);
  githubAuthUrl.searchParams.set("redirect_uri", callbackUrl);
  githubAuthUrl.searchParams.set("scope", "repo read:user");
  githubAuthUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(githubAuthUrl.toString());
  // Store state in a short-lived cookie for CSRF validation
  response.cookies.set("github_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
