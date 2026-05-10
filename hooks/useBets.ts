"use client";

import { useInsforgeAuth } from "@/lib/auth-context";
import { useEffect, useState, useCallback } from "react";
import { insforge, Bet } from "@/lib/insforge";

export function useMyBets() {
  const { user: authUser } = useInsforgeAuth();
  const [bets, setBets] = useState<Bet[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);

    // First resolve the app user row
    const { data: appUser } = await insforge.database
      .from("users")
      .select("id")
      .eq("insforge_user_id", authUser.id)
      .maybeSingle();

    if (!appUser) { setLoading(false); return; }

    const { data } = await insforge.database
      .from("bets")
      .select("*, users(id, display_name, username, avatar_url, hit_rate, current_streak, total_bets)")
      .eq("user_id", appUser.id)
      .order("created_at", { ascending: false });

    setBets((data as Bet[]) || []);
    setLoading(false);
  }, [authUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { bets, loading, refresh };
}

export function useLiveStats() {
  const [stats, setStats] = useState<{
    totalBets: number;
    totalStaked: number;
    hitsThisWeek: number;
  } | null>(null);

  useEffect(() => {
    async function fetch() {
      const { data: betsData } = await insforge.database
        .from("bets")
        .select("stake, status, created_at");

      if (!betsData) return;

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const totalStaked = betsData.reduce((sum: number, b: { stake: string }) => {
        return sum + (parseFloat(b.stake) || 0);
      }, 0);
      const hitsThisWeek = betsData.filter(
        (b: { status: string; created_at: string }) =>
          b.status === "hit" && b.created_at > weekAgo
      ).length;

      setStats({
        totalBets: betsData.length,
        totalStaked,
        hitsThisWeek,
      });
    }
    fetch();
  }, []);

  return stats;
}
