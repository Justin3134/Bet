import { NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";

const NIA_API_KEY = process.env.NIA_API_KEY ?? "";
const NIA_BASE_URL = "https://apigcp.trynia.ai/v2";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!;
const insforgeServer = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });

async function niaEnsureIndexed(repo: string): Promise<void> {
  try {
    const resolveRes = await fetch(
      `${NIA_BASE_URL}/sources/resolve?identifier=${encodeURIComponent(repo)}`,
      { headers: { Authorization: `Bearer ${NIA_API_KEY}` }, signal: AbortSignal.timeout(8000) }
    );
    if (resolveRes.ok) return;
    await fetch(`${NIA_BASE_URL}/sources`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NIA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "repository", repository: repo }),
      signal: AbortSignal.timeout(12000),
    });
    // Give NIA a moment to begin indexing
    await new Promise((r) => setTimeout(r, 3000));
  } catch {
    // Non-fatal
  }
}

async function niaQuerySearch(question: string, repo: string): Promise<string> {
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
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return "";
    const data = await res.json() as Record<string, unknown>;
    return ((data.content ?? data.answer ?? "") as string).slice(0, 1200);
  } catch {
    return "";
  }
}

async function niaWebSearch(query: string): Promise<string> {
  try {
    const res = await fetch(`${NIA_BASE_URL}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NIA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "web",
        query,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return "";
    const data = await res.json() as Record<string, unknown>;
    const content = (data.content ?? data.answer ?? data.text ?? "") as string;
    const sources = (data.sources ?? data.results ?? []) as Array<Record<string, unknown>>;
    const parts: string[] = [];
    if (content) parts.push(content.slice(0, 800));
    if (Array.isArray(sources)) {
      for (const s of sources.slice(0, 5)) {
        const title = (s.title ?? s.name ?? "") as string;
        const snippet = (s.text ?? s.content ?? s.snippet ?? "") as string;
        if (title || snippet) parts.push(`${title}: ${snippet.slice(0, 200)}`);
      }
    }
    return parts.join("\n\n").slice(0, 1200);
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  try {
    // Auth check
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

    const body = await request.json() as { repo?: string };
    const repo = body.repo?.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "") ?? "";
    if (!repo || !repo.includes("/")) {
      return NextResponse.json({ error: "Please provide a valid GitHub repo (owner/repo)" }, { status: 400 });
    }

    if (!NIA_API_KEY) {
      return NextResponse.json({ error: "NIA not configured" }, { status: 503 });
    }

    // 1. Ensure repo is indexed
    await niaEnsureIndexed(repo);

    // 2. Understand the codebase + VC search (all in parallel)
    const repoLabel = repo.split("/")[1] ?? repo;
    const [whatYouBuild, nextGoalRaw, vcContext] = await Promise.all([
      niaQuerySearch(
        `What is this project building? Describe the product, tech stack, and current development stage in 2-3 paragraphs.`,
        repo
      ),
      niaQuerySearch(
        `What are the 3 most impactful features or improvements that should be implemented next in this codebase? Be specific about what code needs to be written.`,
        repo
      ),
      // 3. VC web search — use repo name so this works even before indexing
      niaWebSearch(
        `VC seed investors who funded startups similar to "${repoLabel}" 2023 2024 2025`
      ),
    ]);

    // 4. GPT-4o synthesizes a specific, verifiable goal
    const completion = await insforgeServer.ai.chat.completions.create({
      model: "openai/gpt-4o",
      maxTokens: 300,
      messages: [
        {
          role: "system",
          content: `You are a startup advisor generating a single, specific, verifiable 1-week coding goal for a developer.
The goal must be: specific enough to verify by searching the codebase, achievable in 1-7 days, and directly address a key gap or next step.
Respond with ONLY the goal text, 1-2 sentences, no markdown, no quotes.`,
        },
        {
          role: "user",
          content: `Project: ${whatYouBuild.slice(0, 600)}\n\nNext steps identified:\n${nextGoalRaw.slice(0, 600)}\n\nWrite a single specific coding goal for this developer to bet on this week.`,
        },
      ],
    });

    const suggestedGoal = completion.choices[0].message.content?.trim() ?? nextGoalRaw.split("\n")[0];

    return NextResponse.json({
      what_you_build: whatYouBuild || "NIA is still indexing your repo — try again in 30 seconds.",
      next_goal: nextGoalRaw || "No specific next steps identified yet.",
      vc_context: vcContext || "",
      suggested_goal: suggestedGoal,
      analyzed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[nia-analyze]", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
