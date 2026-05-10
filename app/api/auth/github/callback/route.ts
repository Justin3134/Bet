import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { getAdminClient } from "@/lib/insforge-admin";

const INSFORGE_URL =
  process.env.NEXT_PUBLIC_INSFORGE_URL || "https://4vxtn8fe.us-east.insforge.app";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/onboarding?github_error=1`);
  }

  // Validate state to prevent CSRF
  const cookieState = request.cookies.get("github_oauth_state")?.value;
  if (!state || state !== cookieState) {
    return NextResponse.redirect(`${baseUrl}/onboarding?github_error=csrf`);
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${baseUrl}/api/auth/github/callback`,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${baseUrl}/onboarding?github_error=token`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    return NextResponse.redirect(`${baseUrl}/onboarding?github_error=token`);
  }

  // Fetch GitHub user info
  const githubUserRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!githubUserRes.ok) {
    return NextResponse.redirect(`${baseUrl}/onboarding?github_error=user`);
  }

  const githubUser = await githubUserRes.json();

  // Get current InsForge session from cookies
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

  // Store GitHub token and username in the users table
  const admin = getAdminClient();
  await admin.database
    .from("users")
    .update({
      github_access_token: accessToken,
      github_username: githubUser.login,
      github_connected: true,
    })
    .eq("insforge_user_id", sessionData.user.id);

  const response = NextResponse.redirect(`${baseUrl}/dashboard?github_connected=1`);
  // Clear the CSRF state cookie
  response.cookies.delete("github_oauth_state");
  return response;
}
