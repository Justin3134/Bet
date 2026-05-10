import { getHitRate } from "@/lib/utils";
import { Flame } from "lucide-react";

interface UserStatsProps {
  totalBets: number;
  hitsCount: number;
  missesCount: number;
  currentStreak: number;
  compact?: boolean;
}

export function UserStats({
  totalBets,
  hitsCount,
  missesCount,
  currentStreak,
  compact = false,
}: UserStatsProps) {
  const hitRate = getHitRate(hitsCount, hitsCount + missesCount);

  if (compact) {
    return (
      <div className="flex items-center gap-4 text-mono-xs text-[var(--text-secondary)]">
        <span>
          <span className="text-[var(--text-primary)]">{totalBets}</span> bets
        </span>
        <span>
          <span className="text-[var(--green)]">{hitRate}%</span> hit
        </span>
        {currentStreak > 0 && (
          <span className="flex items-center gap-0.5">
            <Flame size={10} className="text-[var(--accent)]" />
            <span className="text-[var(--accent)]">{currentStreak}</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-mono-xs text-[var(--text-tertiary)] uppercase tracking-wider">
          Hit Rate
        </span>
        <span className="text-mono-sm text-[var(--green)] font-semibold">
          {hitRate}%
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-mono-xs text-[var(--text-tertiary)] uppercase tracking-wider">
          Streak
        </span>
        <span className="flex items-center gap-1 text-mono-sm text-[var(--accent)] font-semibold">
          {currentStreak > 0 ? (
            <>
              <Flame size={12} />
              {currentStreak}
            </>
          ) : (
            <span className="text-[var(--text-tertiary)]">—</span>
          )}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-mono-xs text-[var(--text-tertiary)] uppercase tracking-wider">
          Total Bets
        </span>
        <span className="text-mono-sm text-[var(--text-primary)] font-semibold">
          {totalBets}
        </span>
      </div>
    </div>
  );
}
