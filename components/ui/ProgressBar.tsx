"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

interface ProgressBarProps {
  value: number; // 0-100
  height?: 4 | 8;
  className?: string;
  animated?: boolean;
  showLabel?: boolean;
}

export function ProgressBar({
  value,
  height = 4,
  className,
  animated = true,
  showLabel = false,
}: ProgressBarProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animated) {
      setDisplayValue(value);
      return;
    }
    const timer = setTimeout(() => {
      setMounted(true);
    }, 50);
    return () => clearTimeout(timer);
  }, [animated, value]);

  useEffect(() => {
    if (mounted || !animated) {
      const timer = setTimeout(() => setDisplayValue(value), 10);
      return () => clearTimeout(timer);
    }
  }, [mounted, value, animated]);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="flex-1 bg-[var(--border)] overflow-hidden"
        style={{ height: `${height}px` }}
      >
        <div
          ref={ref}
          className="h-full bg-[var(--accent)] transition-all duration-700 ease-out"
          style={{ width: `${displayValue}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-mono-sm text-[var(--text-secondary)] tabular-nums w-9 text-right">
          {value}%
        </span>
      )}
    </div>
  );
}
