"use client";

import { Suspense } from "react";
import { useRequireAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { GithubIcon } from "@/components/ui/GithubIcon";
import { insforge } from "@/lib/insforge";
import { useEffect, useState } from "react";

function HyperspellLogo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M27.963 25.1327C28.1219 25.409 28.0219 25.7361 27.7881 25.8964C27.6981 25.9581 27.5867 25.9958 27.4639 25.996H4.57721C4.13467 25.9958 3.85733 25.5161 4.07819 25.1327L5.30865 23.0009H26.7325L27.963 25.1327ZM25.4542 20.7831C25.4956 20.8557 25.4898 20.9379 25.4522 21.0009H15.8975C15.865 20.9474 15.854 20.8801 15.877 20.8143C16.0196 20.4085 16.1474 19.9952 16.2598 19.576C16.2961 19.4408 16.1927 19.3089 16.0528 19.3085H7.81061C7.64482 19.3083 7.54145 19.1289 7.62408 18.9852L8.76862 16.9999H23.2725L25.4542 20.7831ZM19.794 11.1835C19.8706 11.1838 19.9422 11.2246 19.9805 11.2909L22.0118 14.8143C22.0466 14.8752 22.0469 14.9424 22.0245 14.9999H16.8467C16.8438 14.5065 16.82 14.0176 16.7764 13.535C16.7666 13.4251 16.6739 13.3411 16.5635 13.3407H11.252C11.0865 13.3405 10.9832 13.1612 11.0655 13.0175L12.0606 11.2909C12.0991 11.2244 12.1704 11.1836 12.2471 11.1835H19.794ZM15.5225 5.28894C15.7438 4.90519 16.2974 4.90516 16.5186 5.28894L18.6592 8.99988H15.7305C15.4488 8.25709 15.1204 7.53696 14.7432 6.84753C14.7072 6.78125 14.7086 6.70104 14.7462 6.63562L15.5225 5.28894Z"
        fill="currentColor"
      />
    </svg>
  );
}

type Step = "github" | "hyperspell";

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingContent />
    </Suspense>
  );
}

function OnboardingContent() {
  const { user: authUser } = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("github");
  const [githubConnected, setGithubConnected] = useState(false);
  const [hyperspellConnected, setHyperspellConnected] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [connectingHyperspell, setConnectingHyperspell] = useState(false);

  useEffect(() => {
    const errCode = searchParams.get("github_error");
    if (errCode) {
      const messages: Record<string, string> = {
        "1": "GitHub authorization was cancelled.",
        csrf: "Security check failed. Please try again.",
        token: "Failed to get GitHub access token. Please try again.",
        user: "Couldn't fetch GitHub user info. Please try again.",
        config: "GitHub OAuth is not configured. Add GITHUB_CLIENT_ID to your environment.",
      };
      setGithubError(messages[errCode] ?? "GitHub connection failed. Please try again.");
    }

    // Check if arriving back from GitHub OAuth (callback sets github_connected)
    if (searchParams.get("github_connected") === "1") {
      setGithubConnected(true);
      setStep("hyperspell");
      return;
    }

    // Check existing connections
    if (authUser) {
      insforge.database
        .from("users")
        .select("github_username, github_connected")
        .eq("insforge_user_id", authUser.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.github_connected) {
            setGithubConnected(true);
            setStep("hyperspell");
          }
        });

      // Check if Hyperspell is already connected — if so, go straight to dashboard
      (async () => {
        const { data: sessionData } = await insforge.auth.refreshSession();
        const token = sessionData?.accessToken ?? "";
        if (!token) return;
        const res = await fetch("/api/hyperspell/status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json().catch(() => ({ connected: false }));
        if (body.connected) {
          setHyperspellConnected(true);
        }
      })();
    }
  }, [searchParams, authUser]);

  const handleConnectGitHub = async () => {
    if (!authUser) return;
    window.location.href = "/api/auth/github";
  };

  const handleConnectHyperspell = async () => {
    setConnectingHyperspell(true);
    try {
      const { data: sessionData } = await insforge.auth.refreshSession();
      const accessToken = sessionData?.accessToken ?? "";
      const res = await fetch("/api/hyperspell/token", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Failed to get token");
      const { token } = await res.json();
      const redirectUri = encodeURIComponent(`${window.location.origin}/dashboard`);
      window.location.href = `https://connect.hyperspell.com?token=${token}&redirect_uri=${redirectUri}`;
    } catch {
      setConnectingHyperspell(false);
    }
  };

  const handleSkipHyperspell = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4">
      <div className="w-full max-w-lg text-center animate-fade-in">
        <div className="mb-12">
          <a href="/" className="text-mono-base text-[var(--accent)] tracking-widest font-bold">
            BET
          </a>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center gap-1.5">
            <span className={`w-5 h-5 flex items-center justify-center text-xs font-bold ${githubConnected ? "bg-[var(--green)] text-[#080808]" : "border border-[var(--accent)] text-[var(--accent)]"}`}>
              {githubConnected ? <Check size={11} /> : "1"}
            </span>
            <span className="text-mono-xs text-[var(--text-tertiary)]">GitHub</span>
          </div>
          <span className="text-[var(--border)] text-xs">—</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-5 h-5 flex items-center justify-center text-xs font-bold ${step === "hyperspell" ? "border border-[var(--accent)] text-[var(--accent)]" : "border border-[var(--border)] text-[var(--text-tertiary)]"}`}>
              2
            </span>
            <span className="text-mono-xs text-[var(--text-tertiary)]">Hyperspell</span>
          </div>
        </div>

        {/* Step 1: GitHub */}
        {step === "github" && (
          <div className="card p-12">
            <div className="w-16 h-16 flex items-center justify-center border border-[var(--border)] mx-auto mb-8">
              <GithubIcon size={28} className="text-[var(--text-secondary)]" />
            </div>

            <h1 className="font-sans text-2xl font-semibold text-[var(--text-primary)] mb-3">
              Connect GitHub
            </h1>
            <p className="font-sans text-[var(--text-secondary)] text-base mb-2">
              The agent watches your repos to verify what you built.
            </p>
            <p className="text-mono-sm text-[var(--text-tertiary)] mb-10">
              We only read commits — we never write anything.
            </p>

            {githubError && (
              <p className="mb-6 text-sm text-[var(--red)] font-sans bg-[var(--red-dim)] px-4 py-3">
                {githubError}
              </p>
            )}

            <button
              onClick={handleConnectGitHub}
              className="w-full flex items-center justify-center gap-3 bg-[var(--accent)] text-[#080808] font-semibold text-base px-6 py-4 hover:opacity-90 transition-opacity mb-4"
            >
              <GithubIcon size={18} />
              Connect GitHub
              <ArrowRight size={16} />
            </button>

            <button
              onClick={() => setStep("hyperspell")}
              className="w-full text-[var(--text-tertiary)] text-sm font-sans hover:text-[var(--text-secondary)] transition-colors py-2"
            >
              Skip for now
            </button>
          </div>
        )}

        {/* Step 2: Hyperspell */}
        {step === "hyperspell" && (
          <div className="card p-12 animate-fade-in">
            <div className={`w-16 h-16 flex items-center justify-center border mx-auto mb-8 ${hyperspellConnected ? "border-[var(--green)] text-[var(--green)]" : "border-[var(--border)] text-[var(--text-secondary)]"}`}>
              {hyperspellConnected ? <Check size={28} /> : <HyperspellLogo size={28} />}
            </div>

            {hyperspellConnected ? (
              <>
                <h1 className="font-sans text-2xl font-semibold text-[var(--text-primary)] mb-3">
                  Hyperspell connected
                </h1>
                <p className="font-sans text-[var(--text-secondary)] text-base mb-10">
                  Your emails and GitHub activity are already connected. You&apos;re all set.
                </p>
                <button
                  onClick={handleSkipHyperspell}
                  className="w-full flex items-center justify-center gap-3 bg-[var(--accent)] text-[#080808] font-semibold text-base px-6 py-4 hover:opacity-90 transition-opacity"
                >
                  Go to dashboard
                  <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <>
                <h1 className="font-sans text-2xl font-semibold text-[var(--text-primary)] mb-3">
                  Connect Hyperspell
                </h1>
                <p className="font-sans text-[var(--text-secondary)] text-base mb-2">
                  Let the AI read your context — emails, GitHub activity — to suggest the right tasks for you to bet on.
                </p>
                <p className="text-mono-sm text-[var(--text-tertiary)] mb-10">
                  Also used to verify email-based goals like &quot;send 5 emails to VCs.&quot;
                </p>

                <button
                  onClick={handleConnectHyperspell}
                  disabled={connectingHyperspell}
                  className="w-full flex items-center justify-center gap-3 bg-[var(--accent)] text-[#080808] font-semibold text-base px-6 py-4 hover:opacity-90 transition-opacity mb-4 disabled:opacity-50"
                >
                  <HyperspellLogo size={18} />
                  {connectingHyperspell ? "Connecting..." : "Connect Hyperspell"}
                  {!connectingHyperspell && <ArrowRight size={16} />}
                </button>

                <button
                  onClick={handleSkipHyperspell}
                  className="w-full text-[var(--text-tertiary)] text-sm font-sans hover:text-[var(--text-secondary)] transition-colors py-2"
                >
                  Skip — I&apos;ll connect later
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
