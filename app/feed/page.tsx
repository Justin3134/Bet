"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { insforge, Bet } from "@/lib/insforge";
import { BetCard } from "@/components/BetCard";
import { BetCardSkeleton } from "@/components/ui/Skeleton";
import { BottomNav } from "@/components/BottomNav";
import { cn } from "@/lib/utils";
import { LiveIndicator } from "@/components/LiveIndicator";

type FilterType = "active" | "hit" | "missed" | "all";
type SortType = "recent" | "stake" | "deadline";

const FILTERS: { value: FilterType; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "hit", label: "Hit" },
  { value: "missed", label: "Missed" },
  { value: "all", label: "All" },
];

const SORTS: { value: SortType; label: string }[] = [
  { value: "recent", label: "Most Recent" },
  { value: "stake", label: "Highest Stake" },
  { value: "deadline", label: "Ending Soon" },
];

export default function FeedPage() {
  const [filter, setFilter] = useState<FilterType>("active");
  const [sort, setSort] = useState<SortType>("recent");
  const [bets, setBets] = useState<Bet[] | null>(null);

  const loadBets = useCallback(async () => {
    setBets(null);
    let query = insforge.database
      .from("bets")
      .select("*, users(id, display_name, username, avatar_url)");

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    if (sort === "recent") {
      query = query.order("created_at", { ascending: false });
    } else if (sort === "deadline") {
      query = query.order("deadline", { ascending: true });
    } else {
      // stake sort: order by stake text won't work perfectly but good enough
      query = query.order("created_at", { ascending: false });
    }

    const { data } = await query.limit(50);
    let results = (data as Bet[]) ?? [];

    if (sort === "stake") {
      results = results.sort((a, b) => (parseFloat(b.stake) || 0) - (parseFloat(a.stake) || 0));
    }

    setBets(results);
  }, [filter, sort]);

  useEffect(() => { loadBets(); }, [loadBets]);

  // Real-time: refresh when any bet changes
  useEffect(() => {
    const rt = insforge.realtime;
    let subscribed = false;

    async function setupRealtime() {
      try {
        await rt.connect();
        await rt.subscribe("bets");
        subscribed = true;
        rt.on("INSERT_bet", () => loadBets());
        rt.on("UPDATE_bet", () => loadBets());
      } catch {
        // realtime optional
      }
    }

    setupRealtime();
    return () => {
      if (subscribed) {
        rt.unsubscribe("bets");
        rt.disconnect();
      }
    };
  }, [loadBets]);

  return (
    <div className="min-h-screen grid-bg">
      <nav className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
        <Link href="/" className="text-mono-sm font-bold text-[var(--accent)] tracking-widest">BET</Link>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm font-sans text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Dashboard</Link>
          <Link href="/bet/new" className="px-3 py-1.5 bg-[var(--accent)] text-[#080808] text-xs font-semibold font-sans hover:opacity-90 transition-opacity">+ New Bet</Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8 pb-24 md:pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 animate-fade-in">
          <div>
            <h1 className="text-xl font-semibold font-sans text-[var(--text-primary)]">All Bets</h1>
            {filter === "active" && (
              <div className="flex items-center gap-2 mt-1">
                <LiveIndicator size="sm" />
                <span className="text-mono-xs text-[var(--text-tertiary)]">Live — updates in real-time</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {SORTS.map((s) => (
              <button key={s.value} onClick={() => setSort(s.value)} className={cn("px-3 py-1 text-mono-xs transition-colors rounded-[2px]", sort === s.value ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]")}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-0 border-b border-[var(--border)] mb-8">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)} className={cn("px-4 py-2.5 text-sm font-sans capitalize transition-colors border-b-2 -mb-px", filter === f.value ? "border-[var(--accent)] text-[var(--text-primary)] font-medium" : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]")}>
              {f.label}
            </button>
          ))}
        </div>

        {bets === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => <BetCardSkeleton key={i} />)}
          </div>
        ) : bets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <p className="text-[var(--text-tertiary)] font-sans text-base">
              {filter === "all" ? "No bets yet. Be first." : `No ${filter} bets.`}
            </p>
            <Link href="/bet/new" className="text-sm text-[var(--accent)] font-sans hover:opacity-80 transition-opacity">Make a bet →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bets.map((bet, i) => (
              <div key={bet.id} className={`animate-fade-in stagger-${Math.min(i + 1, 6)}`}>
                <BetCard bet={bet} />
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
