"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { insforge, Bet } from "@/lib/insforge";
import { BetCard } from "@/components/BetCard";
import { ActivityTicker } from "@/components/ActivityTicker";
import { BetCardSkeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { ArrowRight } from "lucide-react";

function LiveStats() {
  const [stats, setStats] = useState<{ activeBets: number; totalStaked: number; hitRate: number } | null>(null);

  useEffect(() => {
    insforge.database
      .from("bets")
      .select("stake, status")
      .then(({ data }) => {
        if (!data) return;
        const active = data.filter((b: { status: string }) => b.status === "active").length;
        const hits = data.filter((b: { status: string }) => b.status === "hit").length;
        const resolved = data.filter((b: { status: string }) => b.status === "hit" || b.status === "missed").length;
        const totalStaked = data.reduce((sum: number, b: { stake: string }) => sum + (parseFloat(b.stake) || 0), 0);
        setStats({ activeBets: active, totalStaked, hitRate: resolved > 0 ? Math.round((hits / resolved) * 100) : 0 });
      });
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center gap-8 flex-wrap">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="animate-shimmer h-6 w-16" />
            <div className="animate-shimmer h-3 w-20 mt-1" />
          </div>
        ))}
      </div>
    );
  }

  const items = [
    { value: stats.activeBets.toString(), label: "active bets" },
    { value: `$${stats.totalStaked.toLocaleString()}`, label: "at stake" },
    { value: `${stats.hitRate}%`, label: "hit rate" },
  ];

  return (
    <div className="flex items-center gap-8 flex-wrap">
      {items.map((item, i) => (
        <div key={i} className={`animate-fade-in stagger-${i + 4}`}>
          <div className="text-mono-lg font-semibold text-[var(--text-primary)] tabular-nums">{item.value}</div>
          <div className="text-mono-xs text-[var(--text-tertiary)] mt-0.5">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

function LiveFeedPreview() {
  const [bets, setBets] = useState<Bet[] | null>(null);

  useEffect(() => {
    insforge.database
      .from("bets")
      .select("*, users(id, display_name, username, avatar_url)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => setBets((data as Bet[]) ?? []));
  }, []);

  return (
    <div>
      {bets === null ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <BetCardSkeleton key={i} />)}
        </div>
      ) : bets.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-mono-sm text-[var(--text-tertiary)]">No active bets yet. Be first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {bets.map((bet) => <BetCard key={bet.id} bet={bet} />)}
        </div>
      )}
    </div>
  );
}

const HOW_IT_WORKS = [
  { num: "01", title: "State your goal", desc: "Write what you'll build. Set a deadline. Stake real money on it going public." },
  { num: "02", title: "Agent watches your GitHub", desc: "Our AI runs every 30 minutes, reads your commits, and tracks progress against your stated goal." },
  { num: "03", title: "Hit or missed. Publicly.", desc: "No self-reporting. The agent decides. The result is permanent on your profile." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen grid-bg">
      <nav className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-[var(--border)]">
        <Link href="/" className="text-mono-base text-[var(--accent)] tracking-widest font-bold">BET</Link>
        <div className="flex items-center gap-3">
          <Link href="/feed"><Button variant="ghost" size="sm">Feed</Button></Link>
          <Link href="/sign-in"><Button variant="primary" size="sm">Get started</Button></Link>
          <Link href="/sign-in"><Button variant="secondary" size="sm">Sign in</Button></Link>
        </div>
      </nav>

      <section className="px-6 md:px-12 pt-20 pb-16 max-w-6xl mx-auto">
        <div className="max-w-4xl">
          <h1 className="text-display text-[var(--text-primary)] mb-6 animate-fade-in">
            Make the cost of missing real.
          </h1>
          <p className="text-lg md:text-xl text-[var(--text-secondary)] font-sans max-w-2xl leading-relaxed mb-10 animate-fade-in stagger-1">
            Stake real money on your next launch. An AI reads your GitHub commits — not your promises — and rules hit or miss. Miss your deadline, lose your stake. Publicly. Permanently.
          </p>
          <div className="flex flex-wrap items-center gap-4 mb-12 animate-fade-in stagger-2">
            <Link href="/bet/new"><Button size="lg" className="gap-2">Make a Bet<ArrowRight size={16} /></Button></Link>
            <Link href="/feed"><Button variant="secondary" size="lg">See live bets</Button></Link>
          </div>
          <div className="animate-fade-in stagger-3"><LiveStats /></div>
        </div>
        <div className="mt-10 animate-fade-in stagger-4"><ActivityTicker /></div>
      </section>

      <section className="px-6 md:px-12 py-20 max-w-6xl mx-auto border-t border-[var(--border)]">
        <p className="text-mono-xs text-[var(--text-tertiary)] uppercase tracking-widest mb-12 animate-fade-in">How it works</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {HOW_IT_WORKS.map((item, i) => (
            <div key={item.num} className={`flex flex-col gap-4 animate-fade-in stagger-${i + 1}`}>
              <span className="text-mono-lg font-bold text-[var(--accent)]">{item.num}</span>
              <h3 className="text-lg font-semibold text-[var(--text-primary)] font-sans">{item.title}</h3>
              <p className="text-sm text-[var(--text-secondary)] font-sans leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 md:px-12 py-20 max-w-6xl mx-auto border-t border-[var(--border)]">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-mono-xs text-[var(--text-tertiary)] uppercase tracking-widest mb-1">Live</p>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] font-sans">Happening right now</h2>
          </div>
          <Link href="/feed"><Button variant="ghost" size="sm" className="gap-1">See all bets<ArrowRight size={14} /></Button></Link>
        </div>
        <LiveFeedPreview />
      </section>

      <section className="px-6 md:px-12 py-24 max-w-6xl mx-auto border-t border-[var(--border)] text-center">
        <h2 className="text-hero text-[var(--text-primary)] mb-4 max-w-xl mx-auto">What happens if you miss this one too?</h2>
        <p className="text-[var(--text-secondary)] font-sans mb-8 max-w-md mx-auto">Put money on it before you start. The agent doesn&apos;t negotiate.</p>
        <Link href="/sign-in"><Button size="lg" className="gap-2">Make your first bet<ArrowRight size={16} /></Button></Link>
      </section>

      <footer className="px-6 md:px-12 py-6 border-t border-[var(--border)] flex items-center justify-between">
        <span className="text-mono-sm font-bold text-[var(--accent)] tracking-widest">BET</span>
        <span className="text-mono-xs text-[var(--text-tertiary)]">Built at Nozomio Hackathon</span>
      </footer>
    </div>
  );
}
