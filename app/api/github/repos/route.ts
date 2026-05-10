import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/insforge-admin";
import { createClient } from "@insforge/sdk";

const INSFORGE_URL =
  process.env.NEXT_PUBLIC_INSFORGE_URL || "https://4vxtn8fe.us-east.insforge.app";

export async function GET(request: NextRequest) {
  // Forward browser cookies to validate the session against the Insforge backend
  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionClient = createClient({
    baseUrl: INSFORGE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || "",
    headers: { Cookie: cookieHeader },
  });

  const { data: sessionData } = await sessionClient.auth.getCurrentUser();
  if (!sessionData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const insforgeUserId = sessionData.user.id;

  try {
    const admin = getAdminClient();

    const { data: userData } = await admin.database
      .from("users")
      .select("github_access_token, github_username")
      .eq("insforge_user_id", insforgeUserId)
      .maybeSingle();

    if (userData?.github_access_token) {
      const resp = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
        headers: {
          Authorization: `Bearer ${userData.github_access_token}`,
          Accept: "application/vnd.github.v3+json",
        },
      });
      if (resp.ok) {
        const repos = await resp.json();
        return NextResponse.json(repos.map((r: { full_name: string; private: boolean; description: string }) => ({
          fullName: r.full_name,
          private: r.private,
          description: r.description,
        })));
      }
    }

    return NextResponse.json(
      { error: "GitHub not connected", code: "github_not_connected" },
      { status: 400 }
    );
  } catch (error) {
    console.error("GitHub repos error:", error);
    return NextResponse.json({ error: "Failed to fetch repos" }, { status: 500 });
  }
}
