"use client";

import { Evidence, Bet, TensorlakeResult } from "@/lib/insforge";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, GitCommit, CheckCircle, XCircle, FileCode, Cpu, ListChecks, Mail } from "lucide-react";
import { useState } from "react";

interface EvidenceLogProps {
  evidence: Evidence[];
  betStatus: Bet["status"];
  lastCheckedAt?: string | null;
}

function SponsorPill({ label, active }: { label: string; active: boolean }) {
  if (!active) return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium border border-[var(--border)] text-[var(--text-tertiary)] rounded-sm">
      {label}
    </span>
  );
}

function NextStepsBlock({ steps }: { steps: string[] }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <ListChecks size={11} className="text-[var(--green)]" />
        <span className="text-mono-xs text-[var(--text-tertiary)] uppercase tracking-wider">
          Your next steps
        </span>
        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold border border-[var(--green)] text-[var(--green)] rounded-sm opacity-70">
          COACH
        </span>
      </div>
      <div className="pl-3 border-l-2 border-[var(--green)] border-opacity-40 flex flex-col gap-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-mono-xs font-bold text-[var(--green)] opacity-60 flex-shrink-0 mt-px">
              {i + 1}.
            </span>
            <p className="text-mono-xs text-[var(--text-primary)] leading-relaxed">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GmailMatchesBlock({ summary }: { summary: string }) {
  const lines = summary.split("\n").filter((l) => l.trim());
  const header = lines[0]; // "Emails found in Gmail:"
  const emails = lines.slice(1);
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Mail size={11} className="text-[var(--green)]" />
        <span className="text-mono-xs text-[var(--text-tertiary)] uppercase tracking-wider">
          {header}
        </span>
        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold border border-[var(--green)] text-[var(--green)] rounded-sm opacity-70">
          HYPERSPELL
        </span>
      </div>
      <div className="pl-3 border-l-2 border-[var(--green)] border-opacity-40 flex flex-col gap-1.5">
        {emails.map((email, i) => (
          <div key={i} className="flex items-start gap-2">
            <CheckCircle size={10} className="text-[var(--green)] mt-0.5 flex-shrink-0 opacity-70" />
            <p className="text-mono-xs text-[var(--text-secondary)] leading-relaxed">
              {email.replace(/^•\s*/, "")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NiaSummaryBlock({ summary }: { summary: string }) {
  const lines = summary.split("\n").filter((l) => l.trim());
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <FileCode size={11} className="text-[var(--accent)]" />
        <span className="text-mono-xs text-[var(--text-tertiary)] uppercase tracking-wider">
          Codebase analysis
        </span>
        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold border border-[var(--accent)] text-[var(--accent)] rounded-sm opacity-70">
          NIA
        </span>
      </div>
      <div className="pl-3 border-l border-[var(--accent)] border-opacity-30 flex flex-col gap-1.5">
        {lines.slice(0, 8).map((line, i) => (
          <p key={i} className="text-mono-xs text-[var(--text-secondary)] leading-relaxed">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function TensorlakeBlock({ result }: { result: TensorlakeResult }) {
  const isFileScan = result.type === "file_scan";
  const isCloneFailed = result.type === "clone_failed";
  const total = result.tests_passed + result.tests_failed;
  const allPass = total > 0 && result.tests_failed === 0;
  const hasTests = total > 0;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Cpu size={11} className="text-purple-400" />
        <span className="text-mono-xs text-[var(--text-tertiary)] uppercase tracking-wider">
          Code execution
        </span>
        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-semibold border border-purple-400 text-purple-400 rounded-sm opacity-70">
          TENSORLAKE
        </span>
      </div>

      {isCloneFailed ? (
        <div className="pl-3 border-l border-red-500 border-opacity-40">
          <p className="text-mono-xs text-[var(--red)]">{result.summary}</p>
        </div>
      ) : (
        <div className="pl-3 border-l border-purple-400 border-opacity-30 flex flex-col gap-2">
          {/* Test counts */}
          {hasTests && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <CheckCircle size={11} className="text-[var(--green)]" />
                <span className="text-mono-xs text-[var(--green)] font-semibold">
                  {result.tests_passed} passed
                </span>
              </div>
              {result.tests_failed > 0 && (
                <div className="flex items-center gap-1">
                  <XCircle size={11} className="text-[var(--red)]" />
                  <span className="text-mono-xs text-[var(--red)] font-semibold">
                    {result.tests_failed} failed
                  </span>
                </div>
              )}
              <span
                className={cn(
                  "text-mono-xs font-semibold",
                  allPass ? "text-[var(--green)]" : "text-[var(--red)]"
                )}
              >
                {allPass ? "All passing" : `${result.tests_passed}/${total}`}
              </span>
            </div>
          )}

          {/* Build / scan status */}
          {!hasTests && !isFileScan && (
            <div className="flex items-center gap-1.5">
              {result.build_success ? (
                <CheckCircle size={11} className="text-[var(--green)]" />
              ) : (
                <XCircle size={11} className="text-[var(--red)]" />
              )}
              <span
                className={cn(
                  "text-mono-xs font-semibold",
                  result.build_success ? "text-[var(--green)]" : "text-[var(--red)]"
                )}
              >
                {result.build_success ? "Build passed" : `Exit code ${result.exit_code}`}
              </span>
            </div>
          )}

          {/* Summary text */}
          <p className="text-mono-xs text-[var(--text-secondary)] leading-relaxed">
            {result.summary}
          </p>

          {/* Raw output preview */}
          {result.raw_output && !isFileScan && (
            <details className="group">
              <summary className="text-mono-xs text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)] list-none flex items-center gap-1">
                <ChevronDown size={10} className="group-open:hidden" />
                <ChevronUp size={10} className="hidden group-open:block" />
                Show raw output
              </summary>
              <pre className="mt-2 text-[10px] font-mono text-[var(--text-tertiary)] bg-[var(--surface)] border border-[var(--border)] p-2 overflow-x-auto max-h-32 overflow-y-auto leading-relaxed">
                {result.raw_output.slice(0, 1200)}
              </pre>
            </details>
          )}

          {/* File list for file_scan */}
          {isFileScan && result.raw_output && (
            <pre className="text-[10px] font-mono text-[var(--text-tertiary)] leading-relaxed max-h-20 overflow-y-auto">
              {result.raw_output.slice(0, 600)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function EvidenceLog({ evidence, betStatus, lastCheckedAt }: EvidenceLogProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const lastCheckedMs = lastCheckedAt ? new Date(lastCheckedAt).getTime() : undefined;
  const isScanning =
    betStatus === "active" &&
    lastCheckedMs !== undefined &&
    Date.now() - lastCheckedMs > 1000 * 60 * 25;

  return (
    <div className="flex flex-col">
      {/* Scanning entry */}
      {isScanning && (
        <div className="flex gap-5 pb-8 animate-fade-in">
          <div className="flex flex-col items-center gap-0 pt-1.5 flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <div className="w-px flex-1 mt-2 bg-[var(--border)]" />
          </div>
          <div className="flex-1 pb-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-mono-xs text-[var(--accent)]">
                NOW — Scanning commits...
              </span>
            </div>
            <div className="animate-shimmer h-3 w-48 mb-2" />
            <div className="animate-shimmer h-3 w-64 mb-2" />
            <div className="animate-shimmer h-3 w-40" />
          </div>
        </div>
      )}

      {evidence.length === 0 && !isScanning && (
        <div className="py-8 text-center">
          <p className="text-mono-sm text-[var(--text-tertiary)]">
            No evidence yet. Click &ldquo;Check progress&rdquo; to run the agent.
          </p>
        </div>
      )}

      {evidence.map((entry, index) => {
        const isExpanded = expanded[entry.id] ?? index === 0;
        const prevEntry = evidence[index + 1];
        const delta = prevEntry
          ? entry.progress_score - prevEntry.progress_score
          : null;

        const hasNia = !!entry.nia_summary;
        const hasTensorlake = !!entry.tensorlake_result;
        const isEmailBet = !entry.commit_messages || entry.commit_messages.length === 0;
        const hasGmailSummary = !!entry.nia_summary && entry.nia_summary.startsWith("Emails found in Gmail:");
        const hasNiaSummary = !!entry.nia_summary && !entry.nia_summary.startsWith("Emails found in Gmail:");

        return (
          <div key={entry.id} className="flex gap-5 pb-8 animate-fade-in">
            <div className="flex flex-col items-center gap-0 pt-1.5 flex-shrink-0">
              <div
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  index === 0
                    ? "bg-[var(--accent)]"
                    : "bg-[var(--border)] border border-[var(--text-tertiary)]"
                )}
              />
              {index < evidence.length - 1 && (
                <div className="w-px flex-1 mt-2 bg-[var(--border)]" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {/* Header */}
              <button
                onClick={() => toggle(entry.id)}
                className="w-full flex items-center justify-between gap-2 mb-3 hover:opacity-80 transition-opacity text-left"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-mono-xs text-[var(--text-tertiary)]">
                    {formatRelativeTime(new Date(entry.created_at).getTime())}
                  </span>
                  <span className="text-mono-xs text-[var(--text-secondary)]">
                    Run #{evidence.length - index}
                  </span>
                  <span className="text-mono-xs font-semibold text-[var(--text-primary)]">
                    {entry.progress_score}%
                  </span>
                  {delta !== null && delta !== 0 && (
                    <span
                      className={cn(
                        "text-mono-xs font-semibold",
                        delta > 0
                          ? "text-[var(--green)]"
                          : "text-[var(--red)]"
                      )}
                    >
                      {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}%
                    </span>
                  )}
                  {/* Sponsor attribution pills */}
                  <div className="flex items-center gap-1 ml-1">
                    <SponsorPill label="InsForge" active />
                    <SponsorPill label="NIA" active={hasNiaSummary} />
                    <SponsorPill label="TensorLake" active={hasTensorlake} />
                    <SponsorPill label="Hyperspell" active={isEmailBet && entry.commits_found === 0} />
                  </div>
                </div>
                <span className="text-[var(--text-tertiary)] flex-shrink-0">
                  {isExpanded ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                </span>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="animate-fade-in">
                  {/* Coach: Next steps grounded in Nia gap analysis */}
                  {entry.next_steps && entry.next_steps.length > 0 && (
                    <NextStepsBlock steps={entry.next_steps} />
                  )}

                  {/* Gmail Matches (for email bets) */}
                  {hasGmailSummary && (
                    <GmailMatchesBlock summary={entry.nia_summary!} />
                  )}

                  {/* NIA Codebase Analysis (for github/nia bets) */}
                  {hasNiaSummary && (
                    <NiaSummaryBlock summary={entry.nia_summary!} />
                  )}

                  {/* TensorLake Code Execution */}
                  {entry.tensorlake_result && (
                    <TensorlakeBlock result={entry.tensorlake_result} />
                  )}

                  {/* Commits */}
                  {entry.commit_messages && entry.commit_messages.length > 0 && (
                    <div className="mb-4">
                      <p className="text-mono-xs text-[var(--text-tertiary)] mb-2 uppercase tracking-wider">
                        {entry.commits_found} commit{entry.commits_found !== 1 ? "s" : ""} found
                      </p>
                      <div className="flex flex-col gap-1 pl-3 border-l border-[var(--border)]">
                        {entry.commit_messages.map((msg, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <GitCommit
                              size={10}
                              className="text-[var(--text-tertiary)] mt-0.5 flex-shrink-0"
                            />
                            <span className="text-mono-xs text-[var(--text-secondary)]">
                              {msg}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Agent assessment */}
                  {entry.findings && (
                    <p className="text-sm text-[var(--text-primary)] font-sans leading-relaxed">
                      {entry.findings}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
