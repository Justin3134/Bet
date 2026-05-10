"use client";

import { useState, useEffect } from "react";
import { useRequireAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { GitHubConnect } from "@/components/GitHubConnect";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StakeDisplay } from "@/components/StakeDisplay";
import { cn, formatTimeFromNow } from "@/lib/utils";
import { GitBranch, Mail, Sparkles, Check, Brain, Loader2, ChevronRight } from "lucide-react";
import { GithubIcon } from "@/components/ui/GithubIcon";
import type { NiaContext } from "@/lib/insforge";

const STAKE_CHIPS = [10, 25, 50, 100];

export function BetForm() {
  const { user: authUser } = useRequireAuth();
  const router = useRouter();

  // Step 1: task type
  const [taskType, setTaskType] = useState<"github" | "email" | "nia" | null>(null);

  // GitHub repo (only for github type)
  const [githubRepo, setGithubRepo] = useState("");

  // NIA Advisor state
  const [niaRepo, setNiaRepo] = useState("");
  const [niaAnalyzing, setNiaAnalyzing] = useState(false);
  const [niaStep, setNiaStep] = useState(0); // 0=idle, 1=indexing, 2=analyzing, 3=vc, 4=done
  const [niaResult, setNiaResult] = useState<(NiaContext & { what_you_build: string; next_goal: string; vc_context: string }) | null>(null);
  const [niaError, setNiaError] = useState<string | null>(null);

  // Step 2: goal
  const [goal, setGoal] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // Step 3: deadline + stake
  const [deadline, setDeadline] = useState("");
  const [stakeAmount, setStakeAmount] = useState<number | null>(null);
  const [customStake, setCustomStake] = useState("");
  const [deadlineHelper, setDeadlineHelper] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deadline) { setDeadlineHelper(""); return; }
    const d = new Date(deadline).getTime();
    setDeadlineHelper(formatTimeFromNow(d));
  }, [deadline]);

  const effectiveStake = stakeAmount ?? (parseInt(customStake) || 0);
  const minDeadline = new Date(Date.now() + 1000 * 60 * 60).toISOString().slice(0, 16);

  const showGoalSection = !!taskType && (
    taskType === "email" ||
    (taskType === "github" && !!githubRepo) ||
    (taskType === "nia" && !!niaResult)
  );
  const showDeadlineSection = showGoalSection && goal.trim().length >= 5;
  const showSubmitSection = showDeadlineSection && !!deadline && effectiveStake > 0;

  const handleSuggestGoal = async () => {
    if (!authUser || !taskType) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const headers = insforge.getHttpClient().getHeaders();
      const token = (headers["Authorization"] ?? "").replace("Bearer ", "");
      const res = await fetch("/api/suggest-tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          focus_area: `${taskType === "github" ? "coding on" : "email outreach for"} ${taskType === "github" ? githubRepo : "my project"}`,
          github_repo: taskType === "github" ? githubRepo : "",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const tasks: Array<{ title: string; task_type: string }> = data.tasks ?? [];
      const match = tasks.find((t) => t.task_type === taskType) ?? tasks[0];
      if (match) setGoal(match.title);
    } catch {
      setSuggestError("Could not generate a suggestion. Write your goal below.");
    } finally {
      setSuggesting(false);
    }
  };

  const handleNiaAnalyze = async () => {
    const repoTrimmed = niaRepo.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");
    if (!repoTrimmed.includes("/")) {
      setNiaError("Enter a valid GitHub repo, e.g. owner/repo");
      return;
    }
    setNiaAnalyzing(true);
    setNiaError(null);
    setNiaResult(null);
    setNiaStep(1);
    try {
      const headers = insforge.getHttpClient().getHeaders();
      const token = (headers["Authorization"] ?? "").replace("Bearer ", "");
      // Step transitions for UX feedback
      const stepTimer = setInterval(() => {
        setNiaStep((s) => (s < 3 ? s + 1 : s));
      }, 4000);
      const res = await fetch("/api/nia-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ repo: repoTrimmed }),
      });
      clearInterval(stepTimer);
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Analysis failed");
      }
      const data = await res.json() as NiaContext & { what_you_build: string; next_goal: string; vc_context: string };
      setNiaResult(data);
      setGoal(data.suggested_goal ?? "");
      setNiaStep(4);
    } catch (err) {
      setNiaError(err instanceof Error ? err.message : "Analysis failed");
      setNiaStep(0);
    } finally {
      setNiaAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!authUser || !taskType) return;
    if (!goal.trim()) return setError("Please write your goal.");
    if (!deadline) return setError("Please set a deadline.");
    if (!effectiveStake || effectiveStake < 1) return setError("Please set a stake amount.");
    if (taskType === "github" && !githubRepo) return setError("Please select a GitHub repo.");
    if (taskType === "nia" && !niaRepo) return setError("Please analyze a GitHub repo first.");

    setSubmitting(true);
    setError(null);

    try {
      let { data: insforgeUser } = await insforge.database
        .from("users")
        .select("id")
        .eq("insforge_user_id", authUser.id)
        .maybeSingle();

      if (!insforgeUser) {
        const profile = authUser.profile ?? {};
        const { data: created, error: createError } = await insforge.database
          .from("users")
          .insert({
            insforge_user_id: authUser.id,
            display_name: (profile.name as string) || authUser.email?.split("@")[0] || "Founder",
            avatar_url: (profile.avatar_url as string) || null,
            username: null,
          })
          .select("id")
          .single();

        if (createError || !created) throw new Error("Failed to create user profile. Please refresh.");
        insforgeUser = created;
      }

      const repoForNia = niaRepo.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/$/, "");

      const { data: bet, error: betError } = await insforge.database
        .from("bets")
        .insert({
          user_id: insforgeUser.id,
          goal: goal.trim(),
          stake: effectiveStake.toString(),
          github_repo: taskType === "github" ? githubRepo : taskType === "nia" ? repoForNia : null,
          task_type: taskType,
          deadline: new Date(deadline).toISOString(),
          status: "active",
          ...(taskType === "nia" && niaResult ? { nia_context: niaResult } : {}),
        })
        .select("id")
        .single();

      if (betError || !bet) throw new Error("Failed to create bet.");
      router.push(`/bet/${bet.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create bet.");
      setSubmitting(false);
    }
  };

  const displayUsername = authUser?.profile?.name
    ? (authUser.profile.name as string).split(" ")[0].toLowerCase()
    : authUser?.email?.split("@")[0] ?? "you";

  return (
    <div className="flex flex-col gap-0">
      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-10">
        <span className="text-mono-sm font-semibold text-[var(--accent)]">01</span>
        <span className="text-mono-xs text-[var(--text-tertiary)]">—</span>
        <span className={cn("text-mono-sm", showGoalSection ? "text-[var(--accent)] font-semibold" : "text-[var(--text-tertiary)]")}>02</span>
        <span className="text-mono-xs text-[var(--text-tertiary)]">—</span>
        <span className={cn("text-mono-sm", showDeadlineSection ? "text-[var(--accent)] font-semibold" : "text-[var(--text-tertiary)]")}>03</span>
      </div>

      {/* Step 1: Task type */}
      <div className="mb-10">
        <label className="block text-sm font-semibold text-[var(--text-primary)] font-sans mb-1">
          What kind of bet is this?
        </label>
        <p className="text-xs text-[var(--text-tertiary)] font-sans mb-4">
          The agent will verify your progress automatically.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* GitHub coding */}
          <button
            type="button"
            onClick={() => { setTaskType("github"); setGoal(""); setNiaResult(null); setNiaStep(0); }}
            className={cn(
              "text-left p-5 border transition-all flex flex-col gap-3",
              taskType === "github"
                ? "border-[var(--accent)] bg-[var(--accent-dim)]"
                : "border-[var(--border)] hover:border-[var(--accent)]"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GithubIcon size={14} className="text-[var(--text-secondary)]" />
                <span className="text-sm font-semibold font-sans text-[var(--text-primary)]">GitHub coding</span>
              </div>
              {taskType === "github" && <Check size={14} className="text-[var(--accent)]" />}
            </div>
            <p className="text-xs text-[var(--text-tertiary)] font-sans leading-relaxed">
              Ship code, close PRs, hit commit milestones. Verified via your GitHub commits.
            </p>
          </button>

          {/* Email outreach */}
          <button
            type="button"
            onClick={() => { setTaskType("email"); setGithubRepo(""); setGoal(""); setNiaResult(null); setNiaStep(0); }}
            className={cn(
              "text-left p-5 border transition-all flex flex-col gap-3",
              taskType === "email"
                ? "border-[var(--accent)] bg-[var(--accent-dim)]"
                : "border-[var(--border)] hover:border-[var(--accent)]"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-[var(--text-secondary)]" />
                <span className="text-sm font-semibold font-sans text-[var(--text-primary)]">Email outreach</span>
              </div>
              {taskType === "email" && <Check size={14} className="text-[var(--accent)]" />}
            </div>
            <p className="text-xs text-[var(--text-tertiary)] font-sans leading-relaxed">
              Send cold emails, close deals, reach targets. Verified via your Gmail sent folder.
            </p>
          </button>

          {/* NIA Advisor */}
          <button
            type="button"
            onClick={() => { setTaskType("nia"); setGithubRepo(""); setGoal(""); }}
            className={cn(
              "text-left p-5 border transition-all flex flex-col gap-3",
              taskType === "nia"
                ? "border-[#a855f7] bg-[#a855f7]/5"
                : "border-[var(--border)] hover:border-[#a855f7]"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain size={14} className={taskType === "nia" ? "text-[#a855f7]" : "text-[var(--text-secondary)]"} />
                <span className="text-sm font-semibold font-sans text-[var(--text-primary)]">NIA Advisor</span>
              </div>
              {taskType === "nia" ? (
                <span className="text-[10px] font-mono font-bold text-[#a855f7] border border-[#a855f7] border-opacity-50 px-1.5 py-0.5">NIA</span>
              ) : null}
            </div>
            <p className="text-xs text-[var(--text-tertiary)] font-sans leading-relaxed">
              AI analyzes your repo, finds VC opportunities, sets you a goal. Verified by NIA.
            </p>
          </button>
        </div>

        {/* GitHub repo picker — only shown if github selected */}
        {taskType === "github" && (
          <div className="mt-4 animate-slide-up">
            <p className="text-xs text-[var(--text-tertiary)] font-sans mb-2">
              Which repo will you be committing to?
            </p>
            <GitHubConnect onRepoSelect={setGithubRepo} selectedRepo={githubRepo} />
          </div>
        )}

        {/* NIA Advisor: repo input + analyze */}
        {taskType === "nia" && (
          <div className="mt-4 animate-slide-up">
            <p className="text-xs text-[var(--text-tertiary)] font-sans mb-2">
              Which GitHub repo should NIA analyze?
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={niaRepo}
                onChange={(e) => { setNiaRepo(e.target.value); setNiaResult(null); setNiaStep(0); setNiaError(null); }}
                placeholder="owner/repo"
                disabled={niaAnalyzing}
                className="flex-1 px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] font-mono text-sm focus:outline-none focus:border-[#a855f7] transition-colors disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleNiaAnalyze}
                disabled={niaAnalyzing || !niaRepo.trim()}
                className="px-4 py-2.5 border border-[#a855f7] text-[#a855f7] text-sm font-sans font-medium hover:bg-[#a855f7]/10 transition-colors disabled:opacity-40 flex items-center gap-2 whitespace-nowrap"
              >
                {niaAnalyzing ? (
                  <><Loader2 size={13} className="animate-spin" /> Analyzing...</>
                ) : (
                  <><Brain size={13} /> Analyze with NIA</>
                )}
              </button>
            </div>

            {/* Sequential loading steps */}
            {niaAnalyzing && niaStep > 0 && (
              <div className="mt-3 flex flex-col gap-1.5">
                {[
                  { step: 1, label: "Indexing your codebase with NIA..." },
                  { step: 2, label: "Analyzing what you've built..." },
                  { step: 3, label: "Researching VC deals in your space..." },
                ].map(({ step, label }) => (
                  <div key={step} className="flex items-center gap-2">
                    {niaStep === step ? (
                      <Loader2 size={11} className="animate-spin text-[#a855f7] flex-shrink-0" />
                    ) : niaStep > step ? (
                      <Check size={11} className="text-[#a855f7] flex-shrink-0" />
                    ) : (
                      <div className="w-[11px] h-[11px] rounded-full border border-[var(--border)] flex-shrink-0" />
                    )}
                    <span className={cn("text-xs font-sans", niaStep >= step ? "text-[var(--text-secondary)]" : "text-[var(--text-tertiary)]")}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {niaError && (
              <p className="mt-2 text-xs text-[var(--red)] font-sans">{niaError}</p>
            )}

            {/* NIA Results */}
            {niaResult && niaStep === 4 && (
              <div className="mt-4 flex flex-col gap-3 animate-slide-up">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-[#a855f7] opacity-20" />
                  <span className="text-[10px] font-mono font-bold text-[#a855f7] border border-[#a855f7] border-opacity-40 px-1.5 py-0.5">NIA ANALYSIS</span>
                  <div className="h-px flex-1 bg-[#a855f7] opacity-20" />
                </div>

                {/* What you're building */}
                <div className="p-3 border border-[var(--border)] bg-[var(--surface)]">
                  <p className="text-[10px] font-mono font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">What you&apos;re building</p>
                  <p className="text-xs text-[var(--text-secondary)] font-sans leading-relaxed line-clamp-4">
                    {niaResult.what_you_build}
                  </p>
                </div>

                {/* Suggested goal */}
                <div className="p-3 border border-[#a855f7] border-opacity-40 bg-[#a855f7]/5">
                  <p className="text-[10px] font-mono font-semibold text-[#a855f7] uppercase tracking-wider mb-1.5">Suggested next goal</p>
                  <p className="text-xs text-[var(--text-secondary)] font-sans leading-relaxed mb-2">
                    {niaResult.next_goal}
                  </p>
                  <button
                    type="button"
                    onClick={() => setGoal(niaResult.suggested_goal)}
                    className="flex items-center gap-1 text-[10px] font-mono text-[#a855f7] hover:opacity-70 transition-opacity"
                  >
                    <ChevronRight size={10} /> Use this as my goal
                  </button>
                </div>

                {/* VC opportunities */}
                {niaResult.vc_context && (
                  <div className="p-3 border border-[var(--border)] bg-[var(--surface)]">
                    <p className="text-[10px] font-mono font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">VC opportunities</p>
                    <p className="text-xs text-[var(--text-secondary)] font-sans leading-relaxed line-clamp-5">
                      {niaResult.vc_context}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Goal */}
      {showGoalSection && (
        <div className="mb-10 animate-slide-up">
          <label className="block text-sm font-semibold text-[var(--text-primary)] font-sans mb-1">
            What exactly will you do?
          </label>
          <p className="text-xs text-[var(--text-tertiary)] font-sans mb-4">
            Be specific. The agent will hold you to this literally.
          </p>

          <Textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={
              taskType === "github"
                ? "e.g. Ship the auth flow with at least 5 commits by the deadline"
                : "e.g. Send 50 cold emails to B2B SaaS founders this week"
            }
            rows={3}
            className="text-base mb-3"
          />

          <button
            type="button"
            onClick={handleSuggestGoal}
            disabled={suggesting}
            className="flex items-center gap-1.5 text-mono-xs text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
          >
            <Sparkles size={11} />
            {suggesting ? "Generating..." : "Suggest a goal for me"}
          </button>
          {suggestError && (
            <p className="mt-1.5 text-xs text-[var(--text-tertiary)] font-sans">{suggestError}</p>
          )}
        </div>
      )}

      {/* Step 3: Deadline + Stake */}
      {showDeadlineSection && (
        <div className="mb-10 animate-slide-up">
          <div className="mb-6">
            <label className="block text-sm font-semibold text-[var(--text-primary)] font-sans mb-1">
              Deadline
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={minDeadline}
              className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] font-sans text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
            {deadlineHelper && (
              <p className="mt-1.5 text-xs text-[var(--text-secondary)] font-mono">{deadlineHelper}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--text-primary)] font-sans mb-1">
              How much are you putting on this?
            </label>
            <p className="text-xs text-[var(--text-tertiary)] font-sans mb-4">
              If you miss, it goes to charity. If you hit, you keep it — and your reputation.
            </p>

            <div className="flex gap-3 mb-4 flex-wrap">
              {STAKE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => { setStakeAmount(chip); setCustomStake(""); }}
                  className={cn(
                    "px-5 py-2.5 border text-sm font-semibold font-sans transition-all",
                    stakeAmount === chip
                      ? "bg-[var(--accent)] border-[var(--accent)] text-[#080808]"
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  )}
                >
                  ${chip}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--text-tertiary)] font-sans">or</span>
              <div className="relative flex-1 max-w-40">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] font-sans text-sm">$</span>
                <input
                  type="number"
                  placeholder="Custom"
                  value={customStake}
                  onChange={(e) => { setCustomStake(e.target.value); setStakeAmount(null); }}
                  min="1"
                  className="w-full pl-7 pr-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] font-sans text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview + Submit */}
      {showSubmitSection && (
        <div className="animate-slide-up">
          <div className="mb-6">
            <p className="text-xs text-[var(--text-tertiary)] font-mono uppercase tracking-wider mb-3">
              Preview — this is what everyone will see
            </p>
            <div className="card p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Badge status="active" pulse />
                <StakeDisplay amount={effectiveStake} size="sm" animated={false} />
              </div>
              <p className="text-goal-sm text-[var(--text-primary)] line-clamp-3">
                {goal.trim()}
              </p>
              <ProgressBar value={0} height={4} animated={false} />
              <div className="flex items-center justify-between">
                <span className="text-mono-xs text-[var(--text-tertiary)]">@{displayUsername}</span>
                <span className="text-mono-xs text-[var(--text-tertiary)] flex items-center gap-1">
                  {taskType === "github" ? (
                    <><GitBranch size={10} />{githubRepo.split("/")[1] ?? githubRepo}</>
                  ) : taskType === "nia" ? (
                    <><Brain size={10} className="text-[#a855f7]" />{niaRepo.split("/")[1] ?? niaRepo}</>
                  ) : (
                    <><Mail size={10} />email</>
                  )}
                </span>
              </div>
            </div>
          </div>

          {error && <p className="mb-4 text-sm text-[var(--red)] font-sans">{error}</p>}

          <Button
            size="lg"
            onClick={handleSubmit}
            loading={submitting}
            disabled={submitting}
            className="w-full text-base"
          >
            Make it public
          </Button>
          <p className="mt-3 text-xs text-[var(--text-tertiary)] font-sans text-center">
            This bet will be permanently public on your profile.
          </p>
        </div>
      )}
    </div>
  );
}
