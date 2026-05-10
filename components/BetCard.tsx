import Link from "next/link";
import { Bet } from "@/lib/insforge";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Countdown } from "@/components/ui/Countdown";
import { StakeDisplay } from "@/components/StakeDisplay";
import { cn } from "@/lib/utils";
import { GitBranch } from "lucide-react";

interface BetCardProps {
  bet: Bet;
  className?: string;
}

export function BetCard({ bet, className }: BetCardProps) {
  const repoShort = bet.github_repo?.split("/")[1] ?? bet.github_repo ?? "";
  const stakeAmount = parseFloat(bet.stake) || 0;
  const username = bet.users?.username ?? "unknown";

  return (
    <Link href={`/bet/${bet.id}`} className="block group">
      <div
        className={cn(
          "card card-hover p-5 flex flex-col gap-4 h-full",
          className
        )}
      >
        {/* Top row: status + stake + countdown */}
        <div className="flex items-center justify-between gap-2">
          <Badge status={bet.status} pulse={bet.status === "active"} />
          <div className="flex items-center gap-3 ml-auto">
            <StakeDisplay amount={stakeAmount} size="sm" animated={false} />
            {bet.status === "active" && (
              <Countdown deadline={new Date(bet.deadline).getTime()} />
            )}
          </div>
        </div>

        {/* Goal text */}
        <p className="text-goal-sm text-[var(--text-primary)] line-clamp-2 flex-1">
          {bet.goal}
        </p>

        {/* Progress bar */}
        {(bet.status === "active" || bet.status === "pending_eval") && (
          <ProgressBar value={bet.progress_score} height={4} showLabel animated={false} />
        )}
        {bet.status === "hit" && (
          <ProgressBar value={100} height={4} animated={false} />
        )}
        {bet.status === "missed" && (
          <ProgressBar value={bet.progress_score} height={4} animated={false} />
        )}

        {/* Metadata row */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-mono-xs text-[var(--text-tertiary)] flex items-center gap-1">
            @{username}
          </span>
          <div className="flex items-center gap-3">
            {repoShort && (
              <span className="text-mono-xs text-[var(--text-tertiary)] flex items-center gap-1">
                <GitBranch size={10} />
                {repoShort}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
