import { NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { getAdminClient } from "@/lib/insforge-admin";

// TensorLake application invocation endpoint
const TL_INVOKE_URL = "https://api.tensorlake.ai/applications/deep_analyze_repo";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ betId: string }> }
) {
  try {
    const { betId } = await params;

    // Auth check
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
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

    // Fetch the bet
    const insforgeAdmin = getAdminClient();
    const { data: bet, error: betError } = await insforgeAdmin.database
      .from("bets")
      .select("id, goal, github_repo, status, task_type")
      .eq("id", betId)
      .maybeSingle();

    if (betError || !bet) {
      return NextResponse.json({ error: "Bet not found" }, { status: 404 });
    }
    if (bet.status !== "active") {
      return NextResponse.json({ error: "Bet is not active" }, { status: 400 });
    }
    if (!bet.github_repo) {
      return NextResponse.json(
        { error: "Deep analysis requires a linked GitHub repo" },
        { status: 400 }
      );
    }

    const tensorlakeApiKey = process.env.TENSORLAKE_API_KEY ?? "";
    if (!tensorlakeApiKey) {
      return NextResponse.json(
        { error: "TensorLake not configured" },
        { status: 503 }
      );
    }

    // TensorLake pydantic model input: plain JSON body
    const tlPayload = { bet_id: betId, repo: bet.github_repo, goal: bet.goal };
    console.log("[deep-analysis] POST", TL_INVOKE_URL, JSON.stringify(tlPayload));
    const tlRes = await fetch(TL_INVOKE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tensorlakeApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(tlPayload),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    const errText = await tlRes.text().catch(() => "");
    console.log("[deep-analysis] TensorLake response:", tlRes.status, errText);
    if (!tlRes.ok) {
      return NextResponse.json(
        { error: `TensorLake invocation failed: ${tlRes.status} — ${errText}` },
        { status: 502 }
      );
    }

    const tlData = JSON.parse(errText) as Record<string, unknown>;
    const invocationId = (tlData.request_id ?? tlData.invocation_id ?? tlData.id ?? null) as string | null;

    return NextResponse.json({
      status: "invoked",
      invocation_id: invocationId,
      message: "TensorLake is cloning your repo and running tests. Results will appear in the evidence log shortly.",
    });
  } catch (err) {
    console.error("[deep-analysis]", err);
    return NextResponse.json(
      { error: "Failed to invoke deep analysis" },
      { status: 500 }
    );
  }
}
