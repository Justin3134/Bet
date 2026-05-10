"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import type { NiaTask } from "@/lib/insforge";
import { cn } from "@/lib/utils";
import { X, Mail, GitBranch } from "lucide-react";

const DEADLINE_CHIPS = [
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
];

const STAKE_CHIPS = [10, 25, 50, 100];

interface QuickBetModalProps {
  task: NiaTask;
  githubRepo?: string | null;
  onClose: () => void;
}

export function QuickBetModal({ task, githubRepo, onClose }: QuickBetModalProps) {
  const router = useRouter();
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [stakeAmount, setStakeAmount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!selectedDays && !!stakeAmount && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const deadline = new Date(Date.now() + selectedDays * 24 * 60 * 60 * 1000).toISOString();

      const { data: authData } = await insforge.auth.getCurrentUser();
      if (!authData?.user) throw new Error("Not logged in");

      let { data: insforgeUser } = await insforge.database
        .from("users")
        .select("id")
        .eq("insforge_user_id", authData.user.id)
        .maybeSingle();

      if (!insforgeUser) {
        const profile = authData.user.profile ?? {};
        const { data: created, error: createError } = await insforge.database
          .from("users")
          .insert({
            insforge_user_id: authData.user.id,
            display_name: (profile.name as string) || authData.user.email?.split("@")[0] || "Founder",
            avatar_url: (profile.avatar_url as string) || null,
            username: null,
          })
          .select("id")
          .single();
        if (createError || !created) throw new Error("Failed to create user profile.");
        insforgeUser = created;
      }

      const { data: newBet, error: betError } = await insforge.database
        .from("bets")
        .insert({
          user_id: insforgeUser.id,
          goal: task.title,
          stake: stakeAmount.toString(),
          task_type: task.task_type,
          github_repo: task.task_type === "github" ? (githubRepo ?? null) : null,
          deadline,
          status: "active",
        })
        .select("id")
        .single();

      if (betError || !newBet) throw new Error("Failed to create bet.");

      onClose();
      router.push(`/bet/${newBet.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create bet.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative z-10 w-full sm:max-w-md bg-[var(--bg)] border border-[var(--border)] p-6 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            {task.task_type === "email" ? (
              <Mail size={13} className="text-[#a855f7]" />
            ) : (
              <GitBranch size={13} className="text-[#a855f7]" />
            )}
            <span className="text-[10px] font-mono font-bold tracking-wider border border-[#a855f7] border-opacity-40 px-1.5 py-0.5 text-[#a855f7]">
              NIA TASK
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Goal preview */}
        <div className="mb-5 p-4 border border-[var(--border)] bg-[var(--surface)]">
          <p className="text-base font-semibold font-sans text-[var(--text-primary)] leading-snug mb-1.5">
            {task.title}
          </p>
          <p className="text-xs text-[var(--text-secondary)] font-sans leading-relaxed">
            {task.description}
          </p>
        </div>

        {/* Deadline */}
        <div className="mb-5">
          <p className="text-xs font-semibold font-sans text-[var(--text-primary)] mb-2.5">Deadline</p>
          <div className="flex gap-2 flex-wrap">
            {DEADLINE_CHIPS.map(({ label, days }) => (
              <button
                key={days}
                onClick={() => setSelectedDays(days)}
                className={cn(
                  "px-4 py-2 border text-xs font-sans font-medium transition-all",
                  selectedDays === days
                    ? "bg-[var(--accent)] border-[var(--accent)] text-[#080808]"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Stake */}
        <div className="mb-6">
          <p className="text-xs font-semibold font-sans text-[var(--text-primary)] mb-2.5">Stake</p>
          <div className="flex gap-2 flex-wrap">
            {STAKE_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => setStakeAmount(chip)}
                className={cn(
                  "px-4 py-2 border text-xs font-semibold font-sans transition-all",
                  stakeAmount === chip
                    ? "bg-[var(--accent)] border-[var(--accent)] text-[#080808]"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                )}
              >
                ${chip}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="mb-3 text-xs text-[var(--red)] font-sans">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-3 bg-[var(--accent)] text-[#080808] font-semibold font-sans text-sm transition-opacity disabled:opacity-40 hover:opacity-90"
        >
          {submitting ? "Creating bet..." : "Make it public →"}
        </button>
        <p className="mt-2 text-[10px] text-[var(--text-tertiary)] font-sans text-center">
          This bet will be permanently public on your profile.
        </p>
      </div>
    </div>
  );
}
