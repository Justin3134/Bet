"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CountdownProps {
  deadline: number; // unix timestamp in ms
  className?: string;
  large?: boolean;
}

interface TimeLeft {
  days: number;
  hours: number;
  mins: number;
  secs: number;
  expired: boolean;
  totalMs: number;
}

function getTimeLeft(deadline: number): TimeLeft {
  const now = Date.now();
  const diff = deadline - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, mins: 0, secs: 0, expired: true, totalMs: 0 };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, mins, secs, expired: false, totalMs: diff };
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function Countdown({ deadline, className, large = false }: CountdownProps) {
  const [time, setTime] = useState<TimeLeft>(() => getTimeLeft(deadline));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTimeLeft(deadline));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  const isUrgent = time.totalMs < 1000 * 60 * 60; // < 1 hour
  const isWarning = time.totalMs < 1000 * 60 * 60 * 24; // < 24 hours

  const colorClass = time.expired
    ? "text-[var(--text-tertiary)]"
    : isUrgent
    ? "text-[var(--red)]"
    : isWarning
    ? "text-[var(--accent)]"
    : "text-[var(--text-secondary)]";

  if (time.expired) {
    return (
      <span
        className={cn(
          "font-mono text-mono-sm text-[var(--text-tertiary)]",
          large && "text-mono-lg",
          className
        )}
      >
        DEADLINE PASSED
      </span>
    );
  }

  if (large) {
    return (
      <div className={cn("flex items-center gap-4", colorClass, className)}>
        {time.days > 0 && (
          <div className="text-center">
            <div className="font-mono text-4xl font-semibold tabular-nums">
              {pad(time.days)}
            </div>
            <div className="text-mono-xs text-[var(--text-tertiary)] mt-1">DAYS</div>
          </div>
        )}
        <div className="text-center">
          <div className="font-mono text-4xl font-semibold tabular-nums">
            {pad(time.hours)}
          </div>
          <div className="text-mono-xs text-[var(--text-tertiary)] mt-1">HRS</div>
        </div>
        <div className="font-mono text-4xl text-[var(--text-tertiary)]">:</div>
        <div className="text-center">
          <div className="font-mono text-4xl font-semibold tabular-nums">
            {pad(time.mins)}
          </div>
          <div className="text-mono-xs text-[var(--text-tertiary)] mt-1">MIN</div>
        </div>
        <div className="font-mono text-4xl text-[var(--text-tertiary)]">:</div>
        <div className="text-center">
          <div className="font-mono text-4xl font-semibold tabular-nums">
            {pad(time.secs)}
          </div>
          <div className="text-mono-xs text-[var(--text-tertiary)] mt-1">SEC</div>
        </div>
      </div>
    );
  }

  // Compact inline format
  const parts: string[] = [];
  if (time.days > 0) parts.push(`${time.days}d`);
  if (time.hours > 0) parts.push(`${pad(time.hours)}h`);
  parts.push(`${pad(time.mins)}m`);
  if (time.days === 0) parts.push(`${pad(time.secs)}s`);

  return (
    <span
      className={cn(
        "font-mono text-mono-sm tabular-nums",
        colorClass,
        isUrgent && "animate-pulse",
        className
      )}
    >
      {parts.join(" ")}
    </span>
  );
}
