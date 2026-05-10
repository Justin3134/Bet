import { NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import { getAdminClient } from "@/lib/insforge-admin";
import type { NiaContext } from "@/lib/insforge";

const NIA_API_KEY = process.env.NIA_API_KEY ?? "";
const NIA_BASE_URL = "https://apigcp.trynia.ai/v2";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!;
const insforgeServer = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });

// Fire-and-forget — does not block the response
function niaStartIndexing(repo: string): void {
  fetch(`${NIA_BASE_URL}/sources`, {
    method: "POST",
    headers: { Authorization: `Bearer ${NIA_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "repository", repository: repo }),
    signal: AbortSignal.timeout(12000),
  }).catch(() => {});
}

// Semantic codebase search — only works once Nia has indexed the repo
async function niaCodebaseSearch(question: string, repo: string): Promise<string> {
  try {
    const res = await fetch(`${NIA_BASE_URL}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NIA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "query",
        messages: [{ role: "user", content: question }],
        repositories: [repo],
        fast_mode: true,
        include_sources: true,
      }),
      signal: AbortSignal.timeout(18000),
    });
    if (!res.ok) return "";
    const data = await res.json() as Record<string, unknown>;
    return ((data.content ?? data.answer ?? "") as string).slice(0, 1200);
  } catch {
    return "";
  }
}

// Web search — always works, no indexing required
async function niaWebSearch(query: string): Promise<string> {
  try {
    const res = await fetch(`${NIA_BASE_URL}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NIA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "web", query }),
      signal: AbortSignal.timeout(18000),
    });
    if (!res.ok) return "";
    const data = await res.json() as Record<string, unknown>;
    const content = (data.content ?? data.answer ?? data.text ?? "") as string;
    const sources = (data.sources ?? data.results ?? []) as Array<Record<string, unknown>>;
    const parts: string[] = [];
    if (content) parts.push(content.slice(0, 600));
    if (Array.isArray(sources)) {
      for (const s of sources.slice(0, 4)) {
        const title = (s.title ?? s.name ?? "") as string;
        const snippet = (s.text ?? s.content ?? s.snippet ?? "") as string;
        if (title || snippet) parts.push(`${title}: ${snippet.slice(0, 200)}`);
      }
    }
    return parts.join("\n\n").slice(0, 1000);
  } catch {
    return "";
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ betId: string }> }
) {
  try {
    const { betId } = await params;

    const authHeader = request.headers.get("authorization");
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient({
      baseUrl: INSFORGE_URL,
      anonKey: INSFORGE_ANON_KEY,
      isServerMode: true,
      edgeFunctionToken: token,
    });
    const { data: authData, error: authError } = await userClient.auth.getCurrentUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!NIA_API_KEY) {
      return NextResponse.json({ error: "NIA not configured" }, { status: 503 });
    }

    const insforgeAdmin = getAdminClient();

    const { data: bet, error: betError } = await insforgeAdmin.database
      .from("bets")
      .select("id, goal, github_repo, task_type")
      .eq("id", betId)
      .maybeSingle();

    if (betError || !bet) {
      return NextResponse.json({ error: "Bet not found" }, { status: 404 });
    }

    if (bet.task_type !== "nia") {
      return NextResponse.json({ error: "Not a NIA bet" }, { status: 400 });
    }

    const repo = (bet.github_repo ?? "").trim();
    const goal = (bet.goal ?? "").trim();

    // Kick off indexing in background — does not block anything below
    if (repo) niaStartIndexing(repo);

    // Run all searches in parallel.
    // Web searches work immediately (no indexing needed).
    // Codebase search may return empty if not indexed yet — that's fine.
    const repoLabel = repo ? repo.split("/")[1] ?? repo : "this project";
    const [whatYouBuild, trendingRaw, vcRaw] = await Promise.all([
      repo
        ? niaCodebaseSearch(
            `What is this project building? Describe the product, tech stack, and stage in 2-3 paragraphs.`,
            repo
          )
        : Promise.resolve(""),
      niaWebSearch(
        `trending startups viral products 2025 in the space of: ${goal}`
      ),
      niaWebSearch(
        `VC seed investors who funded startups similar to "${repoLabel}" or "${goal.slice(0, 60)}" 2023 2024 2025`
      ),
    ]);

    // GPT-4o synthesizes structured output: trending summary + vc_leads + nia_tasks
    const synthesis = await insforgeServer.ai.chat.completions.create({
      model: "openai/gpt-4o",
      maxTokens: 800,
      messages: [
        {
          role: "system",
          content: `You are a startup advisor for a developer accountability platform called BET.
Given information about a developer's project, generate:
1. A "trending" summary: 1-2 sentences on what is currently hot/viral in this space that they should know about.
2. "vc_leads": exactly 2 real VC firms relevant to this space, each with a specific outreach task the developer can bet on.
3. "nia_tasks": exactly 3 actionable bets the developer should make this week — 1 email outreach task (to a VC or potential customer) and 2 github coding tasks tied to current trends.

For nia_tasks: titles must be concrete and specific (good: "Email Sequoia Capital about BET", bad: "reach out to investors").
For email tasks: task_type = "email". For coding tasks: task_type = "github".

Respond with valid JSON only, no markdown:
{
  "trending": "...",
  "vc_leads": [
    { "name": "...", "description": "why they're relevant and recent investments in this space", "task": "specific 1-sentence outreach task" }
  ],
  "nia_tasks": [
    { "title": "...", "description": "1-2 sentences of context and why this matters", "task_type": "email" | "github" }
  ]
}`,
        },
        {
          role: "user",
          content: `Project goal: ${goal}
GitHub repo: ${repo || "not specified"}
${whatYouBuild ? `What it builds: ${whatYouBuild.slice(0, 500)}` : ""}

Trending data from web:
${trendingRaw || "No trending data found."}

VC funding data from web:
${vcRaw || "No VC data found."}

Generate the trending summary, 2 VC leads, and 3 actionable NIA tasks.`,
        },
      ],
    });

    let synthesisText = synthesis.choices[0].message.content?.trim() ?? "";
    if (synthesisText.startsWith("```")) {
      synthesisText = synthesisText.split("\n").slice(1, -1).join("\n");
    }

    let structured: { trending: string; vc_leads: NiaContext["vc_leads"]; nia_tasks: NiaContext["nia_tasks"] };
    try {
      structured = JSON.parse(synthesisText);
    } catch {
      structured = { trending: trendingRaw.slice(0, 200) || "Analysis complete.", vc_leads: [], nia_tasks: [] };
    }

    const niaContext: NiaContext = {
      what_you_build: whatYouBuild || "",
      next_goal: "",
      vc_context: vcRaw || "",
      suggested_goal: structured.nia_tasks?.[0]?.title ?? goal,
      analyzed_at: new Date().toISOString(),
      trending: structured.trending ?? "",
      vc_leads: structured.vc_leads ?? [],
      nia_tasks: structured.nia_tasks ?? [],
    };

    await insforgeAdmin.database
      .from("bets")
      .update({ nia_context: niaContext })
      .eq("id", betId);

    return NextResponse.json(niaContext);
  } catch (err) {
    console.error("[nia-refresh]", err);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
