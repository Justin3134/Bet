"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { insforge, InsforgeUser, Bet } from "@/lib/insforge";
import { BetCard } from "@/components/BetCard";
import { BetCardSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { LiveIndicator } from "@/components/LiveIndicator";
import { UserStats } from "@/components/UserStats";
import { BottomNav } from "@/components/BottomNav";
import { cn, getHitRate, formatStake } from "@/lib/utils";
import { LayoutDashboard, Layers, PlusCircle, Flame, LogOut } from "lucide-react";
import { GithubIcon } from "@/components/ui/GithubIcon";
import { HyperspellConnectButton } from "@/components/HyperspellConnectButton";

type TabType = "active" | "completed" | "all";

function EmptyState({ tab }: { tab: TabType }) {
  const messages: Record<TabType, string> = {
    active: "Nothing at stake. That's the problem.",
    completed: "No completed bets yet.",
    all: "No bets yet. Put something on the line.",
  };
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <p className="text-[var(--text-tertiary)] font-sans text-base">{messages[tab]}</p>
      <Link href="/bet/new"><Button size="lg">Make a bet</Button></Link>
    </div>
  );
}

export default function DashboardPage() {
  const { user: authUser, signOut } = useRequireAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabType>("active");
  const [insforgeUser, setInsforgeUser] = useState<InsforgeUser | null>(null);
  const [allBets, setAllBets] = useState<Bet[] | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);

    const { data: userData } = await insforge.database
      .from("users")
      .select("*")
      .eq("insforge_user_id", authUser.id)
      .maybeSingle();

    if (!userData) {
      router.replace("/onboarding");
      return;
    }
    setInsforgeUser(userData as InsforgeUser);

    const { data: betsData } = await insforge.database
      .from("bets")
      .select("*, users(id, display_name, username, avatar_url)")
      .eq("user_id", userData.id)
      .order("created_at", { ascending: false });

    setAllBets((betsData as Bet[]) ?? []);
    setLoading(false);
  }, [authUser]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!authUser || loading || !insforgeUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col gap-4 w-64">
          {[1, 2, 3].map((i) => <BetCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  const filteredBets = (allBets ?? []).filter((bet) => {
    if (tab === "active") return bet.status === "active" || bet.status === "pending_eval";
    if (tab === "completed") return bet.status === "hit" || bet.status === "missed";
    return true;
  });

  const activeBetsCount = (allBets ?? []).filter((b) => b.status === "active").length;
  const totalStaked = (allBets ?? []).reduce((sum, b) => sum + (parseFloat(b.stake) || 0), 0);
  const hitRate = getHitRate(insforgeUser.hits_count, insforgeUser.hits_count + insforgeUser.misses_count);

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex flex-col w-60 flex-shrink-0 border-r border-[var(--border)] sticky top-0 h-screen">
        <div className="flex flex-col h-full p-5">
          <Link href="/" className="text-mono-sm font-bold text-[var(--accent)] tracking-widest mb-8">BET</Link>

          <div className="flex items-center gap-3 mb-8 pb-6 border-b border-[var(--border)]">
            {insforgeUser.avatar_url ? (
              <img src={insforgeUser.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-[#080808] text-xs font-bold">
                {(insforgeUser.display_name ?? "?")[0].toUpperCase()}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-[var(--text-primary)] font-sans truncate">
                {insforgeUser.display_name}
              </span>
              <span className="text-mono-xs text-[var(--text-tertiary)]">
                @{insforgeUser.username ?? authUser.email?.split("@")[0]}
              </span>
            </div>
          </div>

          <nav className="flex flex-col gap-1 mb-8">
            <Link href="/dashboard" className="flex items-center gap-2.5 px-3 py-2 text-sm font-sans font-medium text-[var(--text-primary)] bg-[var(--bg-hover)] transition-colors">
              <LayoutDashboard size={15} />Overview
            </Link>
            <Link href="/feed" className="flex items-center gap-2.5 px-3 py-2 text-sm font-sans text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
              <Layers size={15} />Feed
            </Link>
            <Link href="/bet/new" className="flex items-center gap-2.5 px-3 py-2 text-sm font-sans text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
              <PlusCircle size={15} />Create Bet
            </Link>
          </nav>

          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <GithubIcon size={13} className="text-[var(--text-tertiary)]" />
              <span className="text-mono-xs text-[var(--text-tertiary)] uppercase tracking-wider">GitHub</span>
            </div>
            {insforgeUser.github_connected ? (
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
                <span className="text-mono-xs text-[var(--green)]">@{insforgeUser.github_username}</span>
              </div>
            ) : (
              <Link href="/onboarding">
                <span className="text-mono-xs text-[var(--accent)] hover:opacity-80 transition-opacity">Connect →</span>
              </Link>
            )}
          </div>

          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <svg width="13" height="13" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[var(--text-tertiary)]">
                <path d="M27.963 25.1327C28.1219 25.409 28.0219 25.7361 27.7881 25.8964C27.6981 25.9581 27.5867 25.9958 27.4639 25.996H4.57721C4.13467 25.9958 3.85733 25.5161 4.07819 25.1327L5.30865 23.0009H26.7325L27.963 25.1327ZM25.4542 20.7831C25.4956 20.8557 25.4898 20.9379 25.4522 21.0009H15.8975C15.865 20.9474 15.854 20.8801 15.877 20.8143C16.0196 20.4085 16.1474 19.9952 16.2598 19.576C16.2961 19.4408 16.1927 19.3089 16.0528 19.3085H7.81061C7.64482 19.3083 7.54145 19.1289 7.62408 18.9852L8.76862 16.9999H23.2725L25.4542 20.7831ZM19.794 11.1835C19.8706 11.1838 19.9422 11.2246 19.9805 11.2909L22.0118 14.8143C22.0466 14.8752 22.0469 14.9424 22.0245 14.9999H16.8467C16.8438 14.5065 16.82 14.0176 16.7764 13.535C16.7666 13.4251 16.6739 13.3411 16.5635 13.3407H11.252C11.0865 13.3405 10.9832 13.1612 11.0655 13.0175L12.0606 11.2909C12.0991 11.2244 12.1704 11.1836 12.2471 11.1835H19.794ZM15.5225 5.28894C15.7438 4.90519 16.2974 4.90516 16.5186 5.28894L18.6592 8.99988H15.7305C15.4488 8.25709 15.1204 7.53696 14.7432 6.84753C14.7072 6.78125 14.7086 6.70104 14.7462 6.63562L15.5225 5.28894Z" fill="currentColor"/>
              </svg>
              <span className="text-mono-xs text-[var(--text-tertiary)] uppercase tracking-wider">Hyperspell</span>
            </div>
            <HyperspellConnectButton />
          </div>

          <div className="mt-auto pt-6 border-t border-[var(--border)]">
            <UserStats
              totalBets={insforgeUser.total_bets}
              hitsCount={insforgeUser.hits_count}
              missesCount={insforgeUser.misses_count}
              currentStreak={insforgeUser.current_streak}
            />
            <button
              onClick={signOut}
              className="mt-4 flex items-center gap-2 text-mono-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              <LogOut size={12} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-5xl mx-auto px-6 md:px-8 py-8 pb-24 md:pb-8">
          <div className="flex items-center justify-between mb-8 animate-fade-in">
            <h1 className="text-xl font-semibold font-sans text-[var(--text-primary)]">My Bets</h1>
            <Link href="/bet/new">
              <Button size="sm" className="gap-1.5"><PlusCircle size={14} />New Bet</Button>
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Active", value: activeBetsCount.toString(), icon: <LiveIndicator />, color: "text-[var(--text-primary)]" },
              { label: "Hit Rate", value: `${hitRate}%`, icon: null, color: "text-[var(--green)]" },
              { label: "Total Staked", value: formatStake(totalStaked), icon: null, color: "text-[var(--accent)]" },
              { label: "Streak", value: insforgeUser.current_streak > 0 ? `${insforgeUser.current_streak}` : "—", icon: insforgeUser.current_streak > 0 ? <Flame size={14} className="text-[var(--accent)]" /> : null, color: insforgeUser.current_streak > 0 ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]" },
            ].map((stat, i) => (
              <div key={stat.label} className={`card p-4 animate-fade-in stagger-${i + 1}`}>
                <div className="flex items-center gap-2 mb-2">
                  {stat.icon}
                  <span className="text-mono-xs text-[var(--text-tertiary)] uppercase tracking-wider">{stat.label}</span>
                </div>
                <div className={cn("text-2xl font-semibold font-sans tabular-nums", stat.color)}>{stat.value}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-0 border-b border-[var(--border)] mb-6">
            {(["active", "completed", "all"] as TabType[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-2.5 text-sm font-sans capitalize transition-colors border-b-2 -mb-px", tab === t ? "border-[var(--accent)] text-[var(--text-primary)] font-medium" : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]")}>
                {t}
              </button>
            ))}
          </div>

          {allBets === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <BetCardSkeleton key={i} />)}
            </div>
          ) : filteredBets.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBets.map((bet, i) => (
                <div key={bet.id} className={`animate-fade-in stagger-${Math.min(i + 1, 6)}`}>
                  <BetCard bet={bet} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
