import { cn } from "@/lib/utils";

type BadgeStatus = "active" | "hit" | "missed" | "pending_eval";

interface BadgeProps {
  status: BadgeStatus;
  className?: string;
  pulse?: boolean;
}

const STATUS_CONFIG: Record<BadgeStatus, { label: string; className: string }> = {
  active: {
    label: "ACTIVE",
    className: "bg-[var(--blue-dim)] text-[var(--blue)]",
  },
  hit: {
    label: "HIT ✓",
    className: "bg-[var(--green-dim)] text-[var(--green)]",
  },
  missed: {
    label: "MISSED ✗",
    className: "bg-[var(--red-dim)] text-[var(--red)]",
  },
  pending_eval: {
    label: "EVALUATING",
    className: "bg-[var(--accent-dim)] text-[var(--accent)]",
  },
};

export function Badge({ status, className, pulse }: BadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 text-mono-xs font-semibold tracking-wider uppercase",
        "rounded-[2px]",
        config.className,
        className
      )}
    >
      {status === "active" && pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--blue)] animate-pulse-dot" />
      )}
      {config.label}
    </span>
  );
}
