"use client";

import { useState, useEffect } from "react";
import { useInsforgeAuth } from "@/lib/auth-context";
import { insforge } from "@/lib/insforge";
import { GitHubRepo } from "@/lib/github";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface GitHubConnectProps {
  onRepoSelect: (repo: string) => void;
  selectedRepo?: string;
  className?: string;
}

export function GitHubConnect({ onRepoSelect, selectedRepo, className }: GitHubConnectProps) {
  const { user: authUser } = useInsforgeAuth();
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isGithubConnected, setIsGithubConnected] = useState(false);

  useEffect(() => {
    if (!authUser) return;
    insforge.database
      .from("users")
      .select("github_connected, github_username")
      .eq("insforge_user_id", authUser.id)
      .maybeSingle()
      .then(({ data }) => {
        const connected = !!(data?.github_connected || data?.github_username);
        setIsGithubConnected(connected);
        if (connected) loadRepos();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  const loadRepos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/github/repos");
      if (!res.ok) throw new Error("Failed to fetch repos");
      const data = await res.json();
      setRepos(data);
    } catch {
      setError("Couldn't load repos. Try refreshing.");
    } finally {
      setLoading(false);
    }
  };

  const filtered = repos.filter((r) =>
    r.fullName.toLowerCase().includes(search.toLowerCase())
  );

  if (!isGithubConnected) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        <p className="text-xs text-[var(--text-secondary)] font-sans">
          GitHub not connected yet.{" "}
          <a href="/onboarding" className="text-[var(--accent)] hover:opacity-80">
            Connect it here
          </a>{" "}
          or type the repo name below.
        </p>
        <input
          type="text"
          placeholder="owner/repo-name"
          value={selectedRepo ?? ""}
          onChange={(e) => {
            const raw = e.target.value.trim();
            const normalized = raw.replace(/^https?:\/\/github\.com\//, "");
            onRepoSelect(normalized);
          }}
          className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] font-mono text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
        {error && <p className="text-xs text-[var(--red)] font-sans">{error}</p>}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 border border-[var(--border)] bg-[var(--bg)] text-sm font-sans hover:border-[var(--accent)] transition-colors"
      >
        {selectedRepo ? (
          <span className="text-[var(--text-primary)] font-mono text-sm">{selectedRepo}</span>
        ) : loading ? (
          <span className="text-[var(--text-tertiary)]">Loading repos...</span>
        ) : (
          <span className="text-[var(--text-tertiary)]">Select a repository</span>
        )}
        <ChevronDown size={14} className={cn("text-[var(--text-tertiary)] transition-transform", open && "rotate-180")} />
      </button>

      {!open && !selectedRepo && repos.length === 0 && (
        <div className="mt-2">
          <p className="text-xs text-[var(--text-tertiary)] font-sans mb-1">Or type manually:</p>
          <input
            type="text"
            placeholder="owner/repo-name"
            onChange={(e) => {
              const raw = e.target.value.trim();
              const normalized = raw.replace(/^https?:\/\/github\.com\//, "");
              onRepoSelect(normalized);
            }}
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] text-[var(--text-primary)] font-mono text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
      )}

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 bg-[var(--bg-card)] border border-[var(--border)] border-t-0 max-h-64 overflow-hidden">
          <div className="p-2 border-b border-[var(--border)]">
            <div className="flex items-center gap-2 px-2">
              <Search size={12} className="text-[var(--text-tertiary)]" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search repos..."
                className="flex-1 bg-transparent text-sm font-sans text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none py-1"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-mono-xs text-[var(--text-tertiary)]">
                No repos found. Type one manually above.
              </div>
            ) : (
              filtered.map((repo) => (
                <button
                  key={repo.fullName}
                  type="button"
                  onClick={() => { onRepoSelect(repo.fullName); setOpen(false); }}
                  className={cn("w-full flex items-center justify-between px-4 py-2.5 text-left text-sm font-sans hover:bg-[var(--bg-hover)] transition-colors", selectedRepo === repo.fullName && "text-[var(--accent)] bg-[var(--accent-dim)]")}
                >
                  <span className="font-mono text-xs text-[var(--text-primary)]">{repo.fullName}</span>
                  {repo.language && (
                    <span className="text-mono-xs text-[var(--text-tertiary)]">{repo.language}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-[var(--red)] font-sans">{error}</p>}
    </div>
  );
}
