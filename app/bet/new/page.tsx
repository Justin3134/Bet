import Link from "next/link";
import { BetForm } from "@/components/BetForm";
import { ArrowLeft } from "lucide-react";

export default function NewBetPage() {
  return (
    <div className="min-h-screen grid-bg">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm text-[var(--text-secondary)] font-sans hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={14} />
          Dashboard
        </Link>
        <Link href="/" className="text-mono-sm font-bold text-[var(--accent)] tracking-widest">
          BET
        </Link>
      </nav>

      {/* Form */}
      <div className="max-w-xl mx-auto px-6 py-12">
        <div className="mb-10 animate-fade-in">
          <h1 className="text-2xl font-semibold font-sans text-[var(--text-primary)] mb-1.5">
            Make a bet
          </h1>
          <p className="text-sm text-[var(--text-secondary)] font-sans">
            Public, permanent, and judged by an AI.
          </p>
        </div>
        <div className="animate-fade-in stagger-1">
          <BetForm />
        </div>
      </div>
    </div>
  );
}
