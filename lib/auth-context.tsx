"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";

export type InsforgeAuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  providers: string[];
  profile: {
    name?: string;
    avatar_url?: string;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
};

type AuthContextType = {
  user: InsforgeAuthUser | null;
  isLoaded: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoaded: false,
  signOut: async () => {},
});

export function InsforgeAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<InsforgeAuthUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // getCurrentUser() awaits the PKCE code exchange (detectAuthCallback) first,
    // so it works correctly on the OAuth callback landing page too.
    // The 401 from /api/auth/refresh is expected when no session exists — not an error.
    insforge.auth.getCurrentUser().then(({ data }) => {
      setUser((data?.user as InsforgeAuthUser) ?? null);
      setIsLoaded(true);
    }).catch(() => {
      setUser(null);
      setIsLoaded(true);
    });
  }, []);

  const signOut = async () => {
    await insforge.auth.signOut();
    setUser(null);
    window.location.href = "/sign-in";
  };

  return (
    <AuthContext.Provider value={{ user, isLoaded, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useInsforgeAuth() {
  return useContext(AuthContext);
}

/** Redirects to /sign-in if auth has loaded and there is no user. */
export function useRequireAuth() {
  const { user, isLoaded } = useInsforgeAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !user) {
      router.replace("/sign-in");
    }
  }, [isLoaded, user, router]);

  return { user, isLoaded };
}
