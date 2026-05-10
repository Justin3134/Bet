"use client";

import { useEffect, useState } from "react";
import { insforge, Bet } from "@/lib/insforge";
import { formatRelativeTime } from "@/lib/utils";
import { TrendingUp, Zap } from "lucide-react";

export function ActivityTicker() {
  const [bets, setBets] = useState<Bet[]>([]);

  useEffect(() => {
    insforge.database
      .from("bets")
      .select("id, status, stake, goal, created_at, agent_last_run, users(username)")
      .order("created_at", { ascending: false })
      .limit(16)
      .then(({ data }) => {
        if (data) setBets(data as unknown as Bet[]);
      });
  }, []);

  if (bets.length === 0) return null;

  const items = bets.map((bet) => {
    const username = bet.users?.username ?? "someone";
    const stakeAmount = parseFloat(bet.stake) || 0;
    const timeRef = bet.agent_last_run ?? bet.created_at;
    if (bet.status === "hit") {
      return {
        text: `@${username} HIT their goal — "$${stakeAmount} on the line"`,
        icon: "hit" as const,
        time: formatRelativeTime(new Date(timeRef).getTime()),
      };
    } else if (bet.status === "missed") {
      return {
        text: `@${username} missed — $${stakeAmount} gone`,
        icon: "missed" as const,
        time: formatRelativeTime(new Date(timeRef).getTime()),
      };
    } else {
      return {
        text: `@${username} staked $${stakeAmount} on "${(bet.goal ?? "").slice(0, 40)}..."`,
        icon: "active" as const,
        time: formatRelativeTime(new Date(bet.created_at).getTime()),
      };
    }
  });

  const doubled = [...items, ...items];

  return (
    <div className="marquee-container overflow-hidden border-t border-b border-[var(--border)] py-2.5 -mx-6 px-0">
      <div className="flex animate-marquee gap-0 whitespace-nowrap">
        {doubled.map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-6 flex-shrink-0">
            {item.icon === "hit" && (
              <Zap size={10} className="text-[var(--green)] flex-shrink-0" />
            )}
            {item.icon === "missed" && (
              <span className="w-2 h-2 rounded-full bg-[var(--red)] flex-shrink-0" />
            )}
            {item.icon === "active" && (
              <TrendingUp size={10} className="text-[var(--accent)] flex-shrink-0" />
            )}
            <span className="text-mono-xs text-[var(--text-secondary)]">{item.text}</span>
            <span className="text-mono-xs text-[var(--text-tertiary)] ml-1">{item.time}</span>
            <span className="text-[var(--border)] ml-4 mr-2">·</span>
          </div>
        ))}
      </div>
    </div>
  );
}
