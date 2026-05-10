"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Layers, PlusSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInsforgeAuth } from "@/lib/auth-context";

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/feed", icon: Layers, label: "Feed" },
  { href: "/bet/new", icon: PlusSquare, label: "New" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useInsforgeAuth();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-card)] border-t border-[var(--border)] flex md:hidden">
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors",
              isActive
                ? "text-[var(--accent)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            )}
          >
            <Icon size={20} />
            <span className="text-mono-xs">{label}</span>
          </Link>
        );
      })}
      {user ? (
        <Link
          href="/dashboard"
          className={cn(
            "flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors",
            pathname.startsWith("/dashboard")
              ? "text-[var(--accent)]"
              : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          )}
        >
          <User size={20} />
          <span className="text-mono-xs">Me</span>
        </Link>
      ) : (
        <Link
          href="/sign-in"
          className="flex-1 flex flex-col items-center justify-center py-3 gap-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <User size={20} />
          <span className="text-mono-xs">Sign In</span>
        </Link>
      )}
    </nav>
  );
}
