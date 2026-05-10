import { cn } from "@/lib/utils";

interface LiveIndicatorProps {
  className?: string;
  size?: "sm" | "md";
}

export function LiveIndicator({ className, size = "md" }: LiveIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full bg-[var(--green)] animate-pulse-dot flex-shrink-0",
        size === "md" ? "w-2 h-2" : "w-1.5 h-1.5",
        className
      )}
    />
  );
}
