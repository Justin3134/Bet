"use client";

import { useState, useEffect } from "react";

export function useCountdown(deadlineMs: number) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(deadlineMs));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(deadlineMs));
    }, 1000);
    return () => clearInterval(interval);
  }, [deadlineMs]);

  return timeLeft;
}

function getTimeLeft(deadline: number) {
  const now = Date.now();
  const diff = deadline - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, mins: 0, secs: 0, expired: true, totalMs: 0 };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    mins: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    secs: Math.floor((diff % (1000 * 60)) / 1000),
    expired: false,
    totalMs: diff,
  };
}
