"use client";

import { useEffect, useState } from "react";
import { Bet } from "@/lib/insforge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Share2, Check, X } from "lucide-react";

interface VerdictDisplayProps {
  bet: Bet;
}

export function VerdictDisplay({ bet }: VerdictDisplayProps) {
  const [visible, setVisible] = useState(false);
  const [reasonVisible, setReasonVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const isHit = bet.status === "hit";

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 100);
    const t2 = setTimeout(() => setReasonVisible(true), 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <div
      className={cn(
        "w-full px-8 py-12 transition-all duration-500",
        isHit ? "bg-[var(--green-dim)]" : "bg-[var(--red-dim)]",
        "border-t border-b",
        isHit ? "border-[var(--green)]" : "border-[var(--red)]",
        "border-opacity-30"
      )}
    >
      <div className="max-w-3xl mx-auto">
        {/* Big verdict stamp */}
        <div
          className={cn(
            "transition-all duration-400",
            visible ? "opacity-100 scale-100" : "opacity-0 scale-90"
          )}
          style={{ transform: visible ? "scale(1)" : "scale(0.85)", opacity: visible ? 1 : 0, transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease" }}
        >
          <div className="flex items-center gap-4 mb-6">
            <div
              className={cn(
                "w-12 h-12 flex items-center justify-center border-2",
                isHit
                  ? "border-[var(--green)] text-[var(--green)]"
                  : "border-[var(--red)] text-[var(--red)]"
              )}
            >
              {isHit ? <Check size={24} strokeWidth={3} /> : <X size={24} strokeWidth={3} />}
            </div>
            <span
              className={cn(
                "font-mono text-4xl font-bold tracking-widest",
                isHit ? "text-[var(--green)]" : "text-[var(--red)]"
              )}
            >
              {isHit ? "HIT" : "MISSED"}
            </span>
          </div>
        </div>

        {/* Agent reasoning */}
        {bet.verdict_reason && (
          <div
            className="transition-opacity duration-500"
            style={{ opacity: reasonVisible ? 1 : 0 }}
          >
            <p className="text-sm text-[var(--text-primary)] font-sans leading-relaxed max-w-2xl mb-6">
            {bet.verdict_reason}
            </p>
          </div>
        )}

        {/* Share button */}
        {reasonVisible && (
          <button
            onClick={handleShare}
            className={cn(
              "flex items-center gap-2 px-4 py-2 border text-sm font-sans font-medium transition-all animate-fade-in",
              isHit
                ? "border-[var(--green)] text-[var(--green)] hover:bg-[var(--green)] hover:text-[#080808]"
                : "border-[var(--red)] text-[var(--red)] hover:bg-[var(--red)] hover:text-[#080808]"
            )}
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
            {copied ? "Copied!" : "Share this verdict"}
          </button>
        )}
      </div>
    </div>
  );
}
