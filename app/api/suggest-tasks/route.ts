import { NextResponse } from "next/server";
import Hyperspell from "@hyperspell/hyperspell";
import { createClient } from "@insforge/sdk";

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!;

// Server-side InsForge client (anon key, no user token — used for AI calls)
const insforgeServer = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const userId: string = authData.user.id;
    const body = await request.json();
    const { focus_area, github_repo } = body as {
      focus_area: string;
      github_repo?: string;
    };

    if (!focus_area?.trim()) {
      return NextResponse.json({ error: "focus_area is required" }, { status: 400 });
    }

    // Fetch Hyperspell context about the user
    let hyperspellContext = "";
    try {
      const hs = new Hyperspell({
        apiKey: process.env.HYPERSPELL_API_KEY!,
        userID: userId,
      });
      const res = await hs.memories.search({
        query: `What is this person working on? ${focus_area}`,
        answer: false,
        max_results: 5,
      });
      hyperspellContext = (res.documents ?? [])
        .slice(0, 5)
        .map((d) => `[${(d as { title?: string }).title ?? "memory"}]\n${((d as { text?: string }).text ?? "").slice(0, 400)}`)
        .join("\n\n");
    } catch {
      // Hyperspell unavailable — proceed without context
    }

    const repoLine = github_repo ? `\nGitHub repo: ${github_repo}` : "";
    const contextSection = hyperspellContext
      ? `\n\nContext from user's emails and GitHub activity:\n${hyperspellContext}`
      : "";

    const systemPrompt = `You are a productivity coach for a developer accountability platform called BET.
Given what a developer is working on, generate 4-5 specific, concrete, verifiable tasks they should bet on.

Rules:
- Each task must be something that can be verified — either by checking GitHub commits (task_type: "github") or by checking sent emails (task_type: "email")
- Tasks should be achievable within 1-7 days
- Be specific: "Deploy the app to Render" is good, "work on the app" is not
- For email tasks, require a specific count or recipient type (e.g. "Send 3 cold emails to VCs")
- For github tasks, describe what code/feature should exist in commits

Respond with valid JSON only, no markdown, in this exact format:
{
  "tasks": [
    { "title": "...", "task_type": "github", "description": "..." },
    { "title": "...", "task_type": "email", "description": "..." }
  ]
}`;

    const userMessage = `What I'm working on: ${focus_area}${repoLine}${contextSection}

Generate 4-5 specific bettable tasks for me.`;

    const completion = await insforgeServer.ai.chat.completions.create({
      model: "openai/gpt-4o",
      maxTokens: 800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    let responseText = completion.choices[0].message.content?.trim() ?? "";
    if (responseText.startsWith("```")) {
      const lines = responseText.split("\n");
      responseText = lines.slice(1, -1).join("\n");
    }

    const parsed = JSON.parse(responseText);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[suggest-tasks]", err);
    return NextResponse.json(
      { error: "Failed to generate tasks" },
      { status: 500 }
    );
  }
}
