"use client";

import { useEffect } from "react";
import { useInsforgeAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { insforge } from "@/lib/insforge";

function CallbackHandler() {
  const { user, isLoaded } = useInsforgeAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      router.replace("/sign-in");
      return;
    }

    async function handleCallback() {
      const redirectUrl = searchParams.get("redirect_url") ?? "/dashboard";

      const { data: existingUser } = await insforge.database
        .from("users")
        .select("id")
        .eq("insforge_user_id", user!.id)
        .maybeSingle();

      if (!existingUser) {
        const name = user!.profile?.name as string | undefined;
        const avatarUrl = user!.profile?.avatar_url as string | undefined;

        await insforge.database.from("users").insert({
          email: user!.email,
          insforge_user_id: user!.id,
          display_name: name ?? null,
          avatar_url: avatarUrl ?? null,
          email_verified: user!.emailVerified,
        });

        router.replace("/onboarding");
      } else {
        router.replace(redirectUrl);
      }
    }

    handleCallback();
  }, [isLoaded, user, router, searchParams]);

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <span className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-mono-sm text-[var(--text-tertiary)]">Signing you in…</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen grid-bg flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
