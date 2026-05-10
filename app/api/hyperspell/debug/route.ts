import { NextResponse } from "next/server";
import Hyperspell from "@hyperspell/hyperspell";
import { createClient } from "@insforge/sdk";
import { getAdminClient } from "@/lib/insforge-admin";

/**
 * GET /api/hyperspell/debug
 * Returns raw Hyperspell status + a test search so we can see exactly what's indexed.
 * Protected by auth — only the logged-in user can call this.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
      isServerMode: true,
      edgeFunctionToken: token,
    });
    const { data: authData, error: authError } = await userClient.auth.getCurrentUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const insforgeAdmin = getAdminClient();
    const { data: userRow } = await insforgeAdmin.database
      .from("users")
      .select("id, insforge_user_id")
      .eq("insforge_user_id", authData.user.id)
      .maybeSingle();

    const hyperspellUserId = userRow?.insforge_user_id ?? authData.user.id;
    const apiKey = process.env.HYPERSPELL_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "HYPERSPELL_API_KEY not set in server env" }, { status: 503 });
    }

    const hs = new Hyperspell({ apiKey, userID: hyperspellUserId });

    // 1. Status
    let statusResult: Record<string, unknown> = {};
    let statusError: string | null = null;
    try {
      const s = await hs.memories.status();
      statusResult = s as unknown as Record<string, unknown>;
    } catch (e) {
      statusError = e instanceof Error ? e.message : String(e);
    }

    // 2. Connections list
    let connections: unknown[] = [];
    let connectionsError: string | null = null;
    try {
      const c = await hs.connections.list();
      connections = c.connections ?? [];
    } catch (e) {
      connectionsError = e instanceof Error ? e.message : String(e);
    }

    // 3. Broad email search (no date filter) to see what's actually indexed
    let searchDocs: unknown[] = [];
    let searchError: string | null = null;
    try {
      const r = await hs.memories.search({
        query: "email",
        answer: false,
        sources: ["google_mail", "gmail_actions"],
        options: { max_results: 5 },
      });
      searchDocs = (r.documents ?? []).map((d) => {
        const doc = d as Record<string, unknown>;
        return {
          title: doc.title,
          date: doc.date,
          from: doc.from,
          to: doc.to,
          text_preview: doc.text ? String(doc.text).slice(0, 200) : null,
          metadata: doc.metadata,
        };
      });
    } catch (e) {
      searchError = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json({
      hyperspell_user_id: hyperspellUserId,
      insforge_user_id: authData.user.id,
      api_key_set: !!apiKey,
      status: statusResult,
      status_error: statusError,
      connections,
      connections_error: connectionsError,
      recent_emails_found: searchDocs.length,
      recent_emails: searchDocs,
      search_error: searchError,
    });
  } catch (err) {
    console.error("[hyperspell/debug]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
