"use client";

export const dynamic = "force-dynamic";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/auth-context";
import { insforge, Bet, Evidence, InsforgeUser } from "@/lib/insforge";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Countdown } from "@/components/ui/Countdown";
import { StakeDisplay } from "@/components/StakeDisplay";
import { EvidenceLog } from "@/components/EvidenceLog";
import { VerdictDisplay } from "@/components/VerdictDisplay";
import { BetCardSkeleton } from "@/components/ui/Skeleton";
import { formatDeadline, formatRelativeTime } from "@/lib/utils";
import { GitBranch, Calendar, ArrowLeft, ExternalLink, RefreshCw, Cpu, Brain, RotateCcw, TrendingUp, Mail, Zap } from "lucide-react";
import { QuickBetModal } from "@/components/QuickBetModal";
import type { NiaTask } from "@/lib/insforge";

export default function BetPage() {
  const params = useParams();
  const betId = params.id as string;

  useRequireAuth();

  const [bet, setBet] = useState<Bet | null | undefined>(undefined);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [betUser, setBetUser] = useState<InsforgeUser | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [deepAnalyzing, setDeepAnalyzing] = useState(false);
  const [deepAnalysisStatus, setDeepAnalysisStatus] = useState<string | null>(null);
  const [niaRefreshing, setNiaRefreshing] = useState(false);
  const [quickBetTask, setQuickBetTask] = useState<NiaTask | null>(null);

  // Initial data fetch
  useEffect(() => {
    insforge.database
      .from("bets")
      .select("*, users(id, display_name, username, avatar_url, hit_rate, hits_count, misses_count, total_bets, current_streak, github_username)")
      .eq("id", betId)
      .maybeSingle()
      .then(({ data }) => {
        setBet((data as Bet) ?? null);
        if (data?.users) setBetUser(data.users as InsforgeUser);
      });

    insforge.database
      .from("evidence")
      .select("*")
      .eq("bet_id", betId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setEvidence((data as Evidence[]) ?? []));
  }, [betId]);

  // Real-time: update progress live when agent runs
  useEffect(() => {
    const rt = insforge.realtime;
    let subscribed = false;

    async function setup() {
      try {
        await rt.connect();
        await rt.subscribe(`bet:${betId}`);
        subscribed = true;
        rt.on("UPDATE_bet", (payload: { id: string; status: string; progress_score: number }) => {
          setBet((prev) => prev ? { ...prev, ...payload, status: payload.status as Bet["status"] } : prev);
        });
      } catch { /* realtime optional */ }
    }

    setup();
    return () => {
      if (subscribed) { rt.unsubscribe(`bet:${betId}`); rt.disconnect(); }
    };
  }, [betId]);

  const handleCheckProgress = async () => {
    setChecking(true);
    setCheckError(null);
    try {
      const { data: sessionData, error: sessionError } = await insforge.auth.refreshSession();
      if (sessionError || !sessionData?.accessToken) {
        setCheckError("Session expired. Please sign out and sign back in.");
        return;
      }
      const token = sessionData.accessToken;
      const res = await fetch(`/api/check-progress/${betId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to check progress");
      }
      // Refresh both the bet (status may have changed to "hit") and evidence
      const [{ data: betData }, { data: evidenceData }] = await Promise.all([
        insforge.database
          .from("bets")
          .select("*, users(id, display_name, username, avatar_url, hit_rate, hits_count, misses_count, total_bets, current_streak, github_username)")
          .eq("id", betId)
          .maybeSingle(),
        insforge.database
          .from("evidence")
          .select("*")
          .eq("bet_id", betId)
          .order("created_at", { ascending: false }),
      ]);
      if (betData) setBet(betData as Bet);
      if (evidenceData) setEvidence(evidenceData as Evidence[]);
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : "Failed to check progress");
    } finally {
      setChecking(false);
    }
  };

  const handleDeepAnalysis = async () => {
    setDeepAnalyzing(true);
    setDeepAnalysisStatus(null);
    try {
      const { data: sessionData, error: sessionError } = await insforge.auth.refreshSession();
      if (sessionError || !sessionData?.accessToken) {
        setDeepAnalysisStatus("error:Session expired. Please sign out and sign back in.");
        return;
      }
      const token = sessionData.accessToken;
      const res = await fetch(`/api/deep-analysis/${betId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({})) as { message?: string; error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Deep analysis failed");
      }
      setDeepAnalysisStatus("ok");
      // Poll for updated evidence every 5s for up to 2 minutes
      let polls = 0;
      const interval = setInterval(async () => {
        polls++;
        const { data: evidenceData } = await insforge.database
          .from("evidence")
          .select("*")
          .eq("bet_id", betId)
          .order("created_at", { ascending: false });
        if (evidenceData) setEvidence(evidenceData as Evidence[]);
        if (polls >= 24) {
          clearInterval(interval);
          setDeepAnalysisStatus(null);
        }
      }, 5000);
    } catch (err) {
      setDeepAnalysisStatus("error:" + (err instanceof Error ? err.message : "Deep analysis failed"));
    } finally {
      setDeepAnalyzing(false);
    }
  };

  const handleNiaRefresh = async () => {
    if (!bet || niaRefreshing) return;
    setNiaRefreshing(true);
    try {
      const { data: sessionData, error: sessionError } = await insforge.auth.refreshSession();
      if (sessionError || !sessionData?.accessToken) return;
      const token = sessionData.accessToken;
      const res = await fetch(`/api/nia-refresh/${betId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setBet((prev) => prev ? { ...prev, nia_context: body } : prev);
      }
    } catch {
      // Silent fail — user can click again
    } finally {
      setNiaRefreshing(false);
    }
  };

  // Auto-trigger NIA analysis when tasks haven't been generated yet
  useEffect(() => {
    if (
      bet?.task_type === "nia" &&
      !bet?.nia_context?.nia_tasks?.length &&
      !niaRefreshing
    ) {
      const timer = setTimeout(() => { handleNiaRefresh(); }, 1500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bet?.id, bet?.nia_context?.nia_tasks?.length]);

  if (bet === undefined) {
    return (
      <div className="min-h-screen grid-bg">
        <nav className="flex items-center px-6 py-5 border-b border-[var(--border)]">
          <Link href="/feed" className="flex items-center gap-2 text-sm text-[var(--text-secondary)] font-sans hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeft size={14} /> Feed
          </Link>
          <Link href="/" className="ml-auto text-mono-sm font-bold text-[var(--accent)] tracking-widest">BET</Link>
        </nav>
        <div className="max-w-4xl mx-auto px-6 py-12"><BetCardSkeleton /></div>
      </div>
    );
  }

  if (!bet) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-mono-sm text-[var(--text-tertiary)]">Bet not found.</p>
          <Link href="/feed" className="mt-4 inline-block text-sm text-[var(--accent)] font-sans">Back to feed →</Link>
        </div>
      </div>
    );
  }

  const isResolved = bet.status === "hit" || bet.status === "missed";
  const stakeAmount = parseFloat(bet.stake) || 0;
  const username = betUser?.username ?? "unknown";
  const currentProgress = isResolved && bet.status === "hit"
    ? 100
    : (evidence[0]?.progress_score ?? bet.progress_score);

  return (
    <div className="min-h-screen grid-bg">
      <nav className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
        <Link href="/feed" className="flex items-center gap-2 text-sm text-[var(--text-secondary)] font-sans hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeft size={14} /> Feed
        </Link>
        <Link href="/" className="text-mono-sm font-bold text-[var(--accent)] tracking-widest">BET</Link>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col lg:flex-row gap-10">
          <div className="flex-1 min-w-0">
            <div className="mb-10 animate-fade-in">
              <div className="mb-5"><Badge status={bet.status} pulse={bet.status === "active"} /></div>
              <h1 className="text-hero text-[var(--text-primary)] mb-6 leading-tight">{bet.goal}</h1>

              <div className="flex flex-wrap items-center gap-5 mb-8">
                <Link href={`/profile/${username}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                  {betUser?.avatar_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={betUser.avatar_url} alt={username} className="w-6 h-6 rounded-full" />
                  )}
                  <span className="text-sm font-sans text-[var(--text-secondary)]">@{username}</span>
                </Link>
                <span className="text-[var(--border)]">·</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-sans text-[var(--text-secondary)]">staking</span>
                  <StakeDisplay amount={stakeAmount} size="sm" animated={false} />
                </div>
                <span className="text-[var(--border)]">·</span>
                <div className="flex items-center gap-1.5 text-sm font-sans text-[var(--text-secondary)]">
                  <Calendar size={12} />
                  {formatDeadline(new Date(bet.deadline).getTime())}
                </div>
              </div>

              {bet.status === "active" && (
                <div className="mb-8 animate-fade-in stagger-1">
                  <p className="text-mono-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-4">Time remaining</p>
                  <Countdown deadline={new Date(bet.deadline).getTime()} large />
                </div>
              )}

              <div className="mb-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-mono-xs text-[var(--text-tertiary)] uppercase tracking-wider">Progress</span>
                  <span className="text-mono-sm text-[var(--text-primary)] font-semibold">
                    {currentProgress}%
                  </span>
                </div>
                <ProgressBar value={currentProgress} height={8} animated />
              </div>
            </div>

            {isResolved && (
              <div className="mb-10 animate-slide-up"><VerdictDisplay bet={bet} /></div>
            )}

            <div className="animate-fade-in stagger-2">
              <div className="mb-6">
                <div className="flex items-start justify-between gap-4 mb-1">
                  <h2 className="text-lg font-semibold font-sans text-[var(--text-primary)]">Agent evidence log</h2>
                  {!isResolved && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={handleCheckProgress}
                        disabled={checking}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border)] text-mono-xs text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
                      >
                        <RefreshCw size={11} className={checking ? "animate-spin" : ""} />
                        {checking ? "Checking..." : "Check progress"}
                      </button>
                      {bet.github_repo && (
                        <button
                          onClick={handleDeepAnalysis}
                          disabled={deepAnalyzing}
                          title="TensorLake: clone repo and run tests in a live sandbox"
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border)] text-mono-xs text-[var(--text-secondary)] hover:border-purple-400 hover:text-purple-400 transition-colors disabled:opacity-40"
                        >
                          <Cpu size={11} className={deepAnalyzing ? "animate-pulse" : ""} />
                          {deepAnalyzing ? "Cloning repo..." : "Deep analysis"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-sm text-[var(--text-secondary)] font-sans">
                  Checked every 30 minutes.
                  {bet.agent_last_run && (
                    <span className="text-[var(--text-tertiary)]"> Last checked {formatRelativeTime(new Date(bet.agent_last_run).getTime())}.</span>
                  )}
                </p>
                {checkError && (
                  <p className="mt-2 text-xs text-[var(--red)] font-sans">{checkError}</p>
                )}
                {deepAnalysisStatus === "ok" && (
                  <div className="mt-3 flex items-start gap-2.5 px-3 py-2.5 border border-[#a855f7] border-opacity-40 bg-[#a855f7] bg-opacity-5">
                    <Cpu size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#a855f7" }} />
                    <div>
                      <p className="text-mono-xs font-semibold" style={{ color: "#a855f7" }}>TensorLake sandbox running</p>
                      <p className="text-xs font-sans text-[var(--text-secondary)] mt-0.5">
                        Cloning your repo and executing tests in an isolated environment. Results will appear in the evidence log below automatically.
                      </p>
                    </div>
                  </div>
                )}
                {deepAnalysisStatus?.startsWith("error:") && (
                  <p className="mt-2 text-xs text-[var(--red)] font-sans">{deepAnalysisStatus.replace("error:", "")}</p>
                )}
              </div>
              <EvidenceLog evidence={evidence} betStatus={bet.status} lastCheckedAt={bet.agent_last_run} />
            </div>
          </div>

          <aside className="lg:w-72 flex-shrink-0 flex flex-col gap-4">
            <div className="card p-5 animate-fade-in stagger-1">
              <h3 className="text-mono-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-4">Bet details</h3>
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-[var(--text-tertiary)] font-sans">Stake</span>
                  <StakeDisplay amount={stakeAmount} size="sm" animated={false} />
                </div>
                {bet.github_repo && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-[var(--text-tertiary)] font-sans">Repo</span>
                    <a href={`https://github.com/${bet.github_repo}`} target="_blank" rel="noopener noreferrer" className="text-mono-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors flex items-center gap-1">
                      <GitBranch size={10} />{bet.github_repo}<ExternalLink size={9} />
                    </a>
                  </div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-[var(--text-tertiary)] font-sans">Deadline</span>
                  <span className="text-mono-xs text-[var(--text-secondary)] text-right">{formatDeadline(new Date(bet.deadline).getTime())}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-[var(--text-tertiary)] font-sans">Agent runs</span>
                  <span className="text-mono-xs text-[var(--text-secondary)]">{evidence.length}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-[var(--text-tertiary)] font-sans">Created</span>
                  <span className="text-mono-xs text-[var(--text-secondary)]">{formatRelativeTime(new Date(bet.created_at).getTime())}</span>
                </div>
              </div>
            </div>

            {/* NIA Intelligence card — only for NIA Advisor bets */}
            {bet.task_type === "nia" && (
              <div className="animate-fade-in stagger-2 border border-[#a855f7] border-opacity-30 bg-[#a855f7]/5">
                {/* Header */}
                <div className="flex items-center gap-2 px-5 pt-5 pb-4 border-b border-[#a855f7] border-opacity-20">
                  <Brain size={13} style={{ color: "#a855f7" }} />
                  <h3 className="text-mono-xs font-bold tracking-wider" style={{ color: "#a855f7" }}>NIA INTELLIGENCE</h3>
                  <span className="ml-auto text-[10px] font-mono border border-[#a855f7] border-opacity-40 px-1.5 py-0.5 text-[#a855f7]">NIA</span>
                </div>

                {/* Loading / not-yet-analyzed state */}
                {niaRefreshing || !bet.nia_context?.nia_tasks?.length ? (
                  <div className="px-5 py-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <RotateCcw size={11} className="animate-spin flex-shrink-0" style={{ color: "#a855f7" }} />
                      <p className="text-xs font-sans text-[var(--text-secondary)]">
                        {niaRefreshing ? "Analyzing your space..." : "Starting NIA analysis..."}
                      </p>
                    </div>
                    <div className="animate-shimmer h-2.5 w-full rounded" />
                    <div className="animate-shimmer h-2.5 w-4/5 rounded" />
                    <div className="animate-shimmer h-2.5 w-3/5 rounded" />
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-[#a855f7] divide-opacity-15">
                    {/* Trending section */}
                    {bet.nia_context.trending && (
                      <div className="px-5 py-4">
                        <div className="flex items-center gap-1.5 mb-2">
                          <TrendingUp size={10} style={{ color: "#a855f7" }} />
                          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                            Trending in your space
                          </p>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] font-sans leading-relaxed">
                          {bet.nia_context.trending}
                        </p>
                      </div>
                    )}

                    {/* NIA Tasks — each has an Execute button */}
                    {bet.nia_context.nia_tasks && bet.nia_context.nia_tasks.length > 0 && (
                      <div className="px-5 py-4">
                        <div className="flex items-center gap-1.5 mb-3">
                          <Zap size={10} style={{ color: "#a855f7" }} />
                          <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                            NIA tasks
                          </p>
                        </div>
                        <div className="flex flex-col gap-3">
                          {bet.nia_context.nia_tasks.map((task, i) => (
                            <div key={i} className="flex flex-col gap-1.5 p-3 border border-[#a855f7] border-opacity-20 bg-[#a855f7]/5">
                              <div className="flex items-start gap-1.5">
                                {task.task_type === "email" ? (
                                  <Mail size={10} className="text-[var(--text-tertiary)] mt-0.5 flex-shrink-0" />
                                ) : (
                                  <GitBranch size={10} className="text-[var(--text-tertiary)] mt-0.5 flex-shrink-0" />
                                )}
                                <p className="text-xs font-semibold font-sans text-[var(--text-primary)] leading-snug">
                                  {task.title}
                                </p>
                              </div>
                              <p className="text-[11px] text-[var(--text-tertiary)] font-sans leading-relaxed">
                                {task.description}
                              </p>
                              <button
                                onClick={() => setQuickBetTask(task)}
                                className="mt-1 self-start flex items-center gap-1 px-3 py-1.5 border border-[#a855f7] border-opacity-60 text-[10px] font-mono font-semibold hover:bg-[#a855f7] hover:text-white transition-all"
                                style={{ color: "#a855f7" }}
                              >
                                Execute → new bet
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="px-5 py-3 flex items-center justify-between">
                      <p className="text-[10px] font-mono text-[var(--text-tertiary)]">
                        {bet.nia_context.analyzed_at
                          ? `Analyzed ${formatRelativeTime(new Date(bet.nia_context.analyzed_at).getTime())}`
                          : ""}
                      </p>
                      <button
                        onClick={handleNiaRefresh}
                        disabled={niaRefreshing}
                        className="flex items-center gap-1 text-[10px] font-mono hover:opacity-70 transition-opacity disabled:opacity-30"
                        style={{ color: "#a855f7" }}
                      >
                        <RotateCcw size={9} className={niaRefreshing ? "animate-spin" : ""} />
                        Re-analyze
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {betUser && (
              <div className="card p-5 animate-fade-in stagger-2">
                <h3 className="text-mono-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-4">Bettor</h3>
                <Link href={`/profile/${betUser.username}`} className="flex items-center gap-3 mb-4 hover:opacity-80 transition-opacity">
                  {betUser.avatar_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={betUser.avatar_url} alt={betUser.display_name ?? ""} className="w-10 h-10 rounded-full" />
                  )}
                  <div>
                    <div className="text-sm font-semibold font-sans text-[var(--text-primary)]">{betUser.display_name}</div>
                    <div className="text-mono-xs text-[var(--text-tertiary)]">@{betUser.username}</div>
                  </div>
                </Link>
                <div className="flex gap-4 text-mono-xs text-[var(--text-secondary)]">
                  <div><span className="text-[var(--text-primary)] font-semibold">{betUser.total_bets}</span> bets</div>
                  <div>
                    <span className="text-[var(--green)] font-semibold">
                      {betUser.hits_count + betUser.misses_count > 0
                        ? Math.round((betUser.hits_count / (betUser.hits_count + betUser.misses_count)) * 100)
                        : 0}%
                    </span>{" "}hit
                  </div>
                </div>
                <Link href={`/profile/${betUser.username}`} className="mt-4 block text-mono-xs text-[var(--accent)] hover:opacity-80 transition-opacity">
                  View profile →
                </Link>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Quick bet modal — triggered by NIA task Execute buttons */}
      {quickBetTask && (
        <QuickBetModal
          task={quickBetTask}
          githubRepo={bet.github_repo}
          onClose={() => setQuickBetTask(null)}
        />
      )}
    </div>
  );
}
