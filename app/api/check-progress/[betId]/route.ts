import { NextResponse } from "next/server";
import Hyperspell from "@hyperspell/hyperspell";
import { createClient } from "@insforge/sdk";
import { getAdminClient } from "@/lib/insforge-admin";

const NIA_API_KEY = process.env.NIA_API_KEY ?? "";
const NIA_BASE_URL = "https://apigcp.trynia.ai/v2";

async function niaRefreshRepo(repo: string): Promise<void> {
  if (!NIA_API_KEY) return;
  try {
    await fetch(`${NIA_BASE_URL}/sources`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NIA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "repository", repository: repo }),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    // Non-blocking
  }
}

async function niaIndexRepo(repo: string): Promise<void> {
  if (!NIA_API_KEY) return;
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
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // Non-blocking
  }
}

// Forward-looking: ask Nia what's MISSING, not what was done.
// This grounds next_steps in real code gaps rather than generic advice.
async function niaScanGaps(goal: string, repo: string): Promise<string> {
  if (!NIA_API_KEY || !repo) return "";
  try {
    const query = `Given the goal is: "${goal}" — what specific code, files, or features are still MISSING from this codebase to fully achieve it? Be concrete about what files and functions still need to be written.`;

    const res = await fetch(`${NIA_BASE_URL}/search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${NIA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "query",
        messages: [{ role: "user", content: query }],
        repositories: [repo],
        fast_mode: true,
        include_sources: true,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) return "";
    const data = await res.json() as Record<string, unknown>;

    const answer = (data.content ?? data.answer ?? data.text ?? "") as string;
    const sources = (data.sources ?? data.results ?? []) as Array<unknown>;
    const parts: string[] = [];

    if (answer && typeof answer === "string") parts.push(answer.slice(0, 1000));

    if (Array.isArray(sources) && sources.length > 0) {
      const filePaths = sources
        .slice(0, 8)
        .map((s) => (typeof s === "string" ? s : (s as Record<string, unknown>).file ?? (s as Record<string, unknown>).path ?? ""))
        .filter(Boolean);
      if (filePaths.length > 0) {
        parts.push(`Files referenced: ${filePaths.join(", ")}`);
      }
    }

    return parts.join("\n\n").trim();
  } catch {
    return "";
  }
}

const INSFORGE_URL = process.env.NEXT_PUBLIC_INSFORGE_URL!;
const INSFORGE_ANON_KEY = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!;
const insforgeServer = createClient({ baseUrl: INSFORGE_URL, anonKey: INSFORGE_ANON_KEY });

// Coach prompt: returns score + findings + next_steps
const EVALUATOR_SYSTEM_PROMPT = `You are an objective technical evaluator AND coach for a developer accountability platform called BET.

Your job: evaluate whether a developer has made progress on a stated goal, and give them 3 concrete next steps.

Rules:
- Be strict and objective. Vague commits like "wip" or "fix stuff" count for very little.
- Specific, descriptive commits that directly relate to the goal count for more.
- For email goals: count only emails clearly matching the goal criteria (sent after the bet started).
- If no evidence is found, the score is 0.
- Do not give partial credit for good intentions — only for verifiable evidence.
- next_steps must be grounded in the Nia gap analysis if available — not generic advice.
- Each next step must be a specific, actionable task (e.g. "Implement POST /api/auth/refresh") not a vague suggestion.

Always respond with valid JSON in this exact format:
{
  "score": <integer 0-100>,
  "findings": "<1-2 sentence assessment of what was found and what's missing>",
  "next_steps": ["<specific action 1>", "<specific action 2>", "<specific action 3>"]
}`;

async function fetchCommits(repo: string, sinceIso: string, token?: string | null) {
  const url = new URL(`https://api.github.com/repos/${repo}/commits`);
  url.searchParams.set("since", sinceIso);
  url.searchParams.set("per_page", "50");

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), { headers });
  if (res.status === 404 || res.status === 401) return [];
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return res.json() as Promise<Array<{ commit: { message: string } }>>;
}

function buildTensorlakeSection(tlResult: Record<string, unknown> | null): string {
  if (!tlResult) return "";
  const total = ((tlResult.tests_passed as number) ?? 0) + ((tlResult.tests_failed as number) ?? 0);
  const passed = (tlResult.tests_passed as number) ?? 0;
  const buildSuccess = tlResult.build_success as boolean;
  const type = tlResult.type as string;

  if (type === "clone_failed") {
    return `\n\nTensorLake sandbox: failed to clone repo.`;
  }
  if (total > 0) {
    return `\n\nTensorLake sandbox (live test execution): ${passed}/${total} tests passing, build_success: ${buildSuccess}.`;
  }
  return `\n\nTensorLake sandbox: build ${buildSuccess ? "passed" : "failed"} (exit code ${tlResult.exit_code}), no test counts detected.`;
}

async function evaluateGitHub(
  goal: string,
  repo: string,
  sinceIso: string,
  token?: string | null,
  tensorlakeResult?: Record<string, unknown> | null
): Promise<{ score: number; findings: string; next_steps: string[]; commits_found: number; nia_summary: string }> {
  const commits = await fetchCommits(repo, sinceIso, token);
  const messages = commits.map((c) => c.commit.message.split("\n")[0]);

  const [, niaSummary] = await Promise.all([
    repo ? niaIndexRepo(repo) : Promise.resolve(),
    repo ? niaScanGaps(goal, repo) : Promise.resolve(""),
  ]);

  if (messages.length === 0) {
    return {
      score: 0,
      findings: "No commits found in this repo since the bet was created.",
      next_steps: [],
      commits_found: 0,
      nia_summary: niaSummary as string,
    };
  }

  const commitsText = messages.map((m) => `- ${m}`).join("\n");
  const niaSection = niaSummary
    ? `\n\nNia gap analysis (what's still MISSING in the codebase):\n${niaSummary}`
    : "";
  const tlSection = buildTensorlakeSection(tensorlakeResult ?? null);

  const completion = await insforgeServer.ai.chat.completions.create({
    model: "openai/gpt-4o",
    maxTokens: 600,
    messages: [
      { role: "system", content: EVALUATOR_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Goal: ${goal}\n\nCommits found:\n${commitsText}${niaSection}${tlSection}\n\nEvaluate the progress score (0-100), provide findings, and list 3 specific next steps.`,
      },
    ],
  });

  let text = completion.choices[0].message.content?.trim() ?? "";
  if (text.startsWith("```")) {
    text = text.split("\n").slice(1, -1).join("\n");
  }

  const result = JSON.parse(text);
  return {
    score: Math.max(0, Math.min(100, parseInt(result.score))),
    findings: String(result.findings),
    next_steps: Array.isArray(result.next_steps) ? result.next_steps.map(String) : [],
    commits_found: messages.length,
    nia_summary: niaSummary as string,
  };
}

async function evaluateNia(
  goal: string,
  repo: string,
  sinceIso: string,
  githubToken?: string | null,
  tensorlakeResult?: Record<string, unknown> | null
): Promise<{ score: number; findings: string; next_steps: string[]; commits_found: number; nia_summary: string }> {
  if (!repo) {
    return { score: 0, findings: "No GitHub repo linked to this bet.", next_steps: [], commits_found: 0, nia_summary: "" };
  }

  const [commits] = await Promise.all([
    fetchCommits(repo, sinceIso, githubToken).catch(() => [] as Array<{ commit: { message: string } }>),
    NIA_API_KEY ? niaRefreshRepo(repo) : Promise.resolve(),
  ]);
  const commitMessages = commits.map((c) => c.commit.message.split("\n")[0]);

  // Forward-looking: what's missing to achieve the goal?
  let niaSummary = "";
  if (NIA_API_KEY) {
    try {
      const res = await fetch(`${NIA_BASE_URL}/search`, {
        method: "POST",
        headers: { Authorization: `Bearer ${NIA_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "query",
          messages: [{ role: "user", content: `Given the goal is: "${goal}" — what specific code, files, or features are still MISSING from this codebase to fully achieve it? Be concrete about what files and functions still need to be written.` }],
          repositories: [repo],
          fast_mode: true,
          include_sources: true,
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (res.ok) {
        const data = await res.json() as Record<string, unknown>;
        const answer = (data.content ?? data.answer ?? data.text ?? "") as string;
        const sources = (data.sources ?? data.results ?? []) as Array<unknown>;
        const parts: string[] = [];
        if (answer) parts.push(answer.slice(0, 1200));
        if (Array.isArray(sources) && sources.length > 0) {
          const paths = sources
            .slice(0, 8)
            .map((s) => (typeof s === "string" ? s : (s as Record<string, unknown>).file ?? (s as Record<string, unknown>).path ?? ""))
            .filter(Boolean);
          if (paths.length > 0) parts.push(`Files: ${paths.join(", ")}`);
        }
        niaSummary = parts.join("\n\n").trim();
      }
    } catch {
      niaSummary = "";
    }
  }

  const hasNia = !!niaSummary;
  const hasCommits = commitMessages.length > 0;

  if (!hasNia && !hasCommits) {
    return {
      score: 0,
      findings: "No code changes found yet. NIA is indexing your repo — if you've already committed, try again in 1-2 minutes.",
      next_steps: [],
      commits_found: 0,
      nia_summary: "",
    };
  }

  let evidenceBlock = "";
  if (hasNia) {
    evidenceBlock += `Nia gap analysis (what's still MISSING in the codebase):\n${niaSummary}`;
  }
  if (hasCommits) {
    if (evidenceBlock) evidenceBlock += "\n\n";
    evidenceBlock += `Recent commits (${commitMessages.length} found):\n${commitMessages.map((m) => `- ${m}`).join("\n")}`;
  }
  if (!hasNia && hasCommits) {
    evidenceBlock += "\n\n(NIA is still indexing the latest code — evaluated from commits only this time.)";
  }

  const tlSection = buildTensorlakeSection(tensorlakeResult ?? null);

  const completion = await insforgeServer.ai.chat.completions.create({
    model: "openai/gpt-4o",
    maxTokens: 600,
    messages: [
      { role: "system", content: EVALUATOR_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Goal: ${goal}\n\n${evidenceBlock}${tlSection}\n\nEvaluate the progress score (0-100), provide findings, and list 3 specific next steps.`,
      },
    ],
  });

  let text = completion.choices[0].message.content?.trim() ?? "";
  if (text.startsWith("```")) {
    text = text.split("\n").slice(1, -1).join("\n");
  }

  const result = JSON.parse(text);
  return {
    score: Math.max(0, Math.min(100, parseInt(result.score))),
    findings: String(result.findings),
    next_steps: Array.isArray(result.next_steps) ? result.next_steps.map(String) : [],
    commits_found: commitMessages.length,
    nia_summary: niaSummary,
  };
}

async function evaluateEmail(
  goal: string,
  userId: string,
  sinceIso: string
): Promise<{ score: number; findings: string; next_steps: string[]; commits_found: number }> {
  let emailContext = "";

  const hs = new Hyperspell({
    apiKey: process.env.HYPERSPELL_API_KEY!,
    userID: userId,
  });

  // Check indexing status
  let gmailIndexed = 0;
  let gmailPending = 0;
  let gmailConnected = true;
  try {
    const statusRes = await hs.memories.status();
    const gmailCounts = statusRes.providers?.google_mail ?? {};
    gmailIndexed = gmailCounts.completed ?? 0;
    gmailPending = (gmailCounts.pending ?? 0) + (gmailCounts.processing ?? 0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // A 401/403 means Gmail is not connected or the token expired
    if (msg.includes("401") || msg.includes("403") || msg.includes("unauthorized") || msg.includes("forbidden")) {
      gmailConnected = false;
    }
    console.warn("[check-progress] Hyperspell status check failed:", msg);
  }

  if (!gmailConnected) {
    return {
      score: 0,
      findings: "Gmail is not connected to Hyperspell. Go to your profile and reconnect Gmail so the agent can read your emails.",
      next_steps: [],
      commits_found: 0,
    };
  }

  // Build a concise search query — Hyperspell's LLM rewrites it for better retrieval
  const searchQuery = `Email sent after ${sinceIso} related to: ${goal}`;

  // Primary search: Gmail only, filtered to emails after bet started
  let res: Awaited<ReturnType<typeof hs.memories.search>>;
  try {
    res = await hs.memories.search({
      query: searchQuery,
      answer: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      effort: "low" as any,
      sources: ["google_mail", "gmail_actions"],
      options: {
        after: sinceIso,
        max_results: 10,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[check-progress] Hyperspell gmail query failed:", message);
    throw new Error(`Hyperspell: ${message}`);
  }

  console.log("[check-progress] gmail search returned", (res.documents ?? []).length, "docs");

  // Fallback: search all sources with the same date filter if Gmail-only returned nothing
  let docs = res.documents ?? [];
  if (docs.length === 0) {
    try {
      const broadRes = await hs.memories.search({
        query: searchQuery,
        answer: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        effort: "low" as any,
        options: {
          after: sinceIso,
          max_results: 10,
        },
      });
      docs = broadRes.documents ?? [];
      console.log("[check-progress] broad fallback search returned", docs.length, "docs");
    } catch {
      // Ignore fallback errors
    }
  }

  // Last-resort fallback: no date filter, in case sinceIso is too narrow or the email
  // has a slightly different timestamp in Hyperspell's index
  if (docs.length === 0) {
    try {
      const noDateRes = await hs.memories.search({
        query: goal,
        answer: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        effort: "low" as any,
        sources: ["google_mail", "gmail_actions"],
        options: { max_results: 10 },
      });
      docs = noDateRes.documents ?? [];
      console.log("[check-progress] no-date fallback search returned", docs.length, "docs");
    } catch {
      // Ignore
    }
  }

  console.log("[check-progress] total docs after all fallbacks:", docs.length);

  emailContext = docs
    .slice(0, 8)
    .map((d) => {
      const doc = d as Record<string, unknown>;
      const lines: string[] = [];
      if (doc.title) lines.push(`Subject: ${doc.title}`);
      if (doc.from) lines.push(`From: ${doc.from}`);
      if (doc.to) lines.push(`To: ${doc.to}`);
      if (doc.recipients) lines.push(`Recipients: ${JSON.stringify(doc.recipients)}`);
      if (doc.date) lines.push(`Date: ${doc.date}`);
      if ((doc.metadata as Record<string, unknown>)?.created_at) {
        lines.push(`Sent: ${(doc.metadata as Record<string, unknown>).created_at}`);
      }
      if (doc.text) lines.push(`Body: ${String(doc.text).slice(0, 400)}`);
      if (Array.isArray(doc.data) && doc.data.length > 0) {
        lines.push(`Details: ${JSON.stringify(doc.data).slice(0, 300)}`);
      }
      return lines.length > 0 ? lines.join("\n") : `[email - no content]`;
    })
    .join("\n\n---\n\n");

  if (!emailContext) {
    if (gmailPending > 0 || gmailIndexed === 0) {
      const indexedMsg = gmailIndexed > 0
        ? `${gmailIndexed.toLocaleString()} emails indexed so far, ${gmailPending.toLocaleString()} still syncing.`
        : "Gmail is still syncing — no emails indexed yet.";
      return {
        score: 0,
        findings: `Gmail is still being indexed. ${indexedMsg} Try again in a few minutes once the sync completes.`,
        next_steps: [],
        commits_found: 0,
      };
    }
    // Hyperspell polls Gmail periodically — a freshly sent email may not be indexed yet
    const betAgeSeconds = (Date.now() - new Date(sinceIso).getTime()) / 1000;
    const recentNote = betAgeSeconds < 900
      ? " If you just sent an email, Hyperspell may not have indexed it yet — wait 5–10 minutes and try again."
      : "";
    return {
      score: 0,
      findings: `No emails related to the goal were found after the bet started (${gmailIndexed.toLocaleString()} emails indexed).${recentNote}`,
      next_steps: [],
      commits_found: 0,
    };
  }

  const completion = await insforgeServer.ai.chat.completions.create({
    model: "openai/gpt-4o",
    maxTokens: 600,
    messages: [
      { role: "system", content: EVALUATOR_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Goal: ${goal}\n\nBet created: ${new Date(betCreatedAt).toISOString()} (a 15-minute grace window before this time is allowed)\n\nEmails found (sent or received) related to the goal:\n${emailContext}\n\nCount emails sent within 15 minutes before OR after the bet was created as valid evidence. Evaluate the progress score (0-100), provide findings, and list 3 specific next steps.`,
      },
    ],
  });

  let text = completion.choices[0].message.content?.trim() ?? "";
  if (text.startsWith("```")) {
    text = text.split("\n").slice(1, -1).join("\n");
  }

  const result = JSON.parse(text);
  return {
    score: Math.max(0, Math.min(100, parseInt(result.score))),
    findings: String(result.findings),
    next_steps: Array.isArray(result.next_steps) ? result.next_steps.map(String) : [],
    commits_found: 0,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ betId: string }> }
) {
  try {
    const { betId } = await params;

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

    const insforgeAdmin = getAdminClient();

    const { data: bet, error: betError } = await insforgeAdmin.database
      .from("bets")
      .select("*, users(id, insforge_user_id, github_access_token)")
      .eq("id", betId)
      .maybeSingle();

    if (betError || !bet) {
      return NextResponse.json({ error: "Bet not found" }, { status: 404 });
    }

    if (bet.status !== "active") {
      return NextResponse.json({ error: "Bet is not active" }, { status: 400 });
    }

    const taskType: string = bet.task_type ?? "github";

    // For email bets, give a 15-minute grace window before the bet creation time.
    // This handles the common case where the user sends an email and creates the bet
    // within seconds of each other — the email timestamp can precede the DB record.
    const betCreatedAt = new Date(bet.created_at).getTime();
    const gracePeriodMs = taskType === "email" ? 15 * 60 * 1000 : 0;
    const sinceIso = new Date(betCreatedAt - gracePeriodMs).toISOString();
    const insforgeUserId: string = bet.users?.insforge_user_id ?? authData.user.id;

    // Fetch the most recent TensorLake result for this bet (if any) to inject into evaluation
    let tensorlakeResult: Record<string, unknown> | null = null;
    try {
      const { data: latestEvidence } = await insforgeAdmin.database
        .from("evidence")
        .select("tensorlake_result")
        .eq("bet_id", betId)
        .not("tensorlake_result", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      tensorlakeResult = (latestEvidence?.tensorlake_result as Record<string, unknown>) ?? null;
    } catch {
      // Non-fatal
    }

    let result: { score: number; findings: string; next_steps: string[]; commits_found: number; nia_summary?: string };

    try {
      if (taskType === "email") {
        result = await evaluateEmail(bet.goal, insforgeUserId, sinceIso);
      } else if (taskType === "nia") {
        const repo = bet.github_repo ?? "";
        const ghToken: string | null = bet.users?.github_access_token ?? bet.github_access_token ?? null;
        result = await evaluateNia(bet.goal, repo, sinceIso, ghToken, tensorlakeResult);
      } else {
        const repo = bet.github_repo ?? "";
        const ghToken: string | null = bet.users?.github_access_token ?? bet.github_access_token ?? null;
        result = await evaluateGitHub(bet.goal, repo, sinceIso, ghToken, tensorlakeResult);
      }
    } catch (evalErr) {
      const message = evalErr instanceof Error ? evalErr.message : "Evaluation failed";
      return NextResponse.json({ error: message }, { status: 503 });
    }

    const now = new Date().toISOString();
    const isComplete = result.score >= 100;

    await insforgeAdmin.database
      .from("bets")
      .update({
        progress_score: result.score,
        progress: result.score,
        commits_found: result.commits_found,
        findings: result.findings,
        agent_last_run: now,
        updated_at: now,
        ...(isComplete && {
          status: "hit",
          verdict_reason: `Goal fully achieved. Final progress score: 100/100. ${result.findings}`,
        }),
      })
      .eq("id", betId);

    await insforgeAdmin.database.from("evidence").insert({
      bet_id: betId,
      agent_version: "manual-check",
      commits_found: result.commits_found,
      progress_score: result.score,
      findings: result.findings,
      next_steps: result.next_steps,
      nia_summary: result.nia_summary ?? null,
    });

    if (isComplete && bet.user_id) {
      const { data: userData } = await insforgeAdmin.database
        .from("users")
        .select("hits_count, misses_count, current_streak, total_bets")
        .eq("id", bet.user_id)
        .maybeSingle();

      if (userData) {
        const hits = (userData.hits_count ?? 0) + 1;
        const misses = userData.misses_count ?? 0;
        const streak = (userData.current_streak ?? 0) + 1;
        const total = Math.max(userData.total_bets ?? 0, hits + misses);
        const hitRate = hits + misses > 0 ? hits / (hits + misses) : 0;

        await insforgeAdmin.database
          .from("users")
          .update({ hits_count: hits, current_streak: streak, hit_rate: hitRate, total_bets: total })
          .eq("id", bet.user_id);
      }
    }

    return NextResponse.json({
      score: result.score,
      findings: result.findings,
      next_steps: result.next_steps,
      nia_summary: result.nia_summary ?? null,
    });
  } catch (err) {
    console.error("[check-progress]", err);
    return NextResponse.json(
      { error: "Failed to check progress" },
      { status: 500 }
    );
  }
}
