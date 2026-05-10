"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface StakeDisplayProps {
  amount: number;
  className?: string;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
}

export function StakeDisplay({
  amount,
  className,
  size = "md",
  animated = true,
}: StakeDisplayProps) {
  const [displayed, setDisplayed] = useState(animated ? 0 : amount);

  useEffect(() => {
    if (!animated) {
      setDisplayed(amount);
      return;
    }

    let start = 0;
    const steps = 20;
    const increment = amount / steps;
    const duration = 800;
    const interval = duration / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= amount) {
        setDisplayed(amount);
        clearInterval(timer);
      } else {
        setDisplayed(Math.floor(start));
      }
    }, interval);

    return () => clearInterval(timer);
  }, [amount, animated]);

  const sizes = {
    sm: "text-sm font-semibold",
    md: "text-base font-semibold",
    lg: "text-xl font-bold",
  };

  return (
    <span
      className={cn(
        "font-sans text-[var(--accent)] tabular-nums",
        sizes[size],
        className
      )}
    >
      ${displayed.toLocaleString()}
    </span>
  );
}
