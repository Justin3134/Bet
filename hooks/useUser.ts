"use client";

import { useEffect, useState } from "react";
import { useInsforgeAuth } from "@/lib/auth-context";
import { insforge, InsforgeUser } from "@/lib/insforge";

export function useInsforgeUser() {
  const { user: authUser, isLoaded: authLoaded } = useInsforgeAuth();
  const [insforgeUser, setInsforgeUser] = useState<InsforgeUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoaded || !authUser) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchOrCreate() {
      setLoading(true);

      const { data } = await insforge.database
        .from("users")
        .select("*")
        .eq("insforge_user_id", authUser!.id)
        .maybeSingle();

      if (data && !cancelled) {
        setInsforgeUser(data as InsforgeUser);
        setLoading(false);
        return;
      }

      // Create profile row on first visit
      const profile = authUser!.profile ?? {};
      const { data: created } = await insforge.database
        .from("users")
        .insert({
          insforge_user_id: authUser!.id,
          display_name: (profile.name as string) || authUser!.email?.split("@")[0] || "Founder",
          avatar_url: (profile.avatar_url as string) || null,
          username: null,
        })
        .select()
        .single();

      if (!cancelled) {
        setInsforgeUser(created as InsforgeUser);
        setLoading(false);
      }
    }

    fetchOrCreate();
    return () => { cancelled = true; };
  }, [authLoaded, authUser]);

  return { authUser, insforgeUser, isLoaded: authLoaded && !loading };
}
