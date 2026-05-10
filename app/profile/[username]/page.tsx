"use client";

export const dynamic = "force-dynamic";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { insforge, InsforgeUser, Bet } from "@/lib/insforge";
import { BetCard } from "@/components/BetCard";
import { BetCardSkeleton } from "@/components/ui/Skeleton";
import { BottomNav } from "@/components/BottomNav";
import { getHitRate } from "@/lib/utils";
import { ArrowLeft, Flame } from "lucide-react";
import { GithubIcon } from "@/components/ui/GithubIcon";

export default function ProfilePage() {
  const params = useParams();
  const username = params.username as string;

  const [user, setUser] = useState<InsforgeUser | null | undefined>(undefined);
  const [bets, setBets] = useState<Bet[] | null>(null);

  useEffect(() => {
    insforge.database
      .from("users")
      .select("*")
      .eq("username", username)
      .maybeSingle()
      .then(({ data }) => {
        setUser((data as InsforgeUser) ?? null);
        if (data) {
          insforge.database
            .from("bets")
            .select("*, users(id, display_name, username, avatar_url)")
            .eq("user_id", data.id)
            .order("created_at", { ascending: false })
            .then(({ data: betsData }) => setBets((betsData as Bet[]) ?? []));
        }
      });
  }, [username]);

  if (user === undefined) {
    return (
      <div className="min-h-screen grid-bg">
        <nav className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
          <Link href="/" className="text-mono-sm font-bold text-[var(--accent)] tracking-widest">BET</Link>
        </nav>
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <BetCardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-mono-sm text-[var(--text-tertiary)]">User not found.</p>
          <Link href="/feed" className="mt-4 inline-block text-sm text-[var(--accent)] font-sans">Back to feed →</Link>
        </div>
      </div>
    );
  }

  const hitRate = getHitRate(user.hits_count, user.hits_count + user.misses_count);
  const totalStaked = (bets ?? []).reduce((s, b) => s + (parseFloat(b.stake) || 0), 0);

  return (
    <div className="min-h-screen grid-bg">
      <nav className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
        <Link href="/feed" className="flex items-center gap-2 text-sm text-[var(--text-secondary)] font-sans hover:text-[var(--text-primary)] transition-colors">
          <ArrowLeft size={14} /> Feed
        </Link>
        <Link href="/" className="text-mono-sm font-bold text-[var(--accent)] tracking-widest">BET</Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10 pb-24 md:pb-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-10 animate-fade-in">
          {user.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt={user.display_name ?? ""} className="w-20 h-20 rounded-full" />
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-semibold font-sans text-[var(--text-primary)] mb-0.5">{user.display_name}</h1>
            <p className="text-mono-sm text-[var(--text-tertiary)] mb-4">@{user.username}</p>

            <div className="flex flex-wrap items-center gap-6">
              <div className="text-center sm:text-left">
                <div className="text-lg font-semibold font-sans text-[var(--text-primary)]">{user.total_bets}</div>
                <div className="text-mono-xs text-[var(--text-tertiary)]">bets</div>
              </div>
              <div className="text-center sm:text-left">
                <div className="text-lg font-semibold font-sans text-[var(--green)]">{hitRate}%</div>
                <div className="text-mono-xs text-[var(--text-tertiary)]">hit rate</div>
              </div>
              <div className="text-center sm:text-left">
                <div className="text-lg font-semibold font-sans text-[var(--accent)]">${totalStaked.toLocaleString()}</div>
                <div className="text-mono-xs text-[var(--text-tertiary)]">staked</div>
              </div>
              {user.current_streak > 0 && (
                <div className="text-center sm:text-left">
                  <div className="text-lg font-semibold font-sans text-[var(--accent)] flex items-center gap-1">
                    <Flame size={16} />{user.current_streak}
                  </div>
                  <div className="text-mono-xs text-[var(--text-tertiary)]">streak</div>
                </div>
              )}
              {user.github_username && (
                <a href={`https://github.com/${user.github_username}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-mono-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                  <GithubIcon size={12} />{user.github_username}
                </a>
              )}
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-mono-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-6">Bet history</h2>

          {bets === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <BetCardSkeleton key={i} />)}
            </div>
          ) : bets.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[var(--text-tertiary)] font-sans text-sm">No bets yet.</p>
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
      </div>

      <BottomNav />
    </div>
  );
}
