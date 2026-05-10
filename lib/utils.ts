import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow, format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatStake(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

export function formatDeadline(timestamp: number): string {
  const date = new Date(timestamp);
  return format(date, "MMM d, yyyy 'at' h:mm a");
}

export function formatRelativeTime(timestamp: number): string {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

export function getHitRate(hits: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((hits / total) * 100);
}

export function formatProgress(score: number): string {
  return `${score}%`;
}

export function getProgressColor(score: number): string {
  if (score >= 75) return "var(--green)";
  if (score >= 50) return "var(--accent)";
  return "var(--text-tertiary)";
}

export function truncateGoal(goal: string, maxLength = 120): string {
  if (goal.length <= maxLength) return goal;
  return goal.slice(0, maxLength).trim() + "…";
}

export function formatTimeFromNow(deadlineMs: number): string {
  const diff = deadlineMs - Date.now();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (diff < 0) return "Deadline passed";
  if (days > 0) return `in ${days}d ${hours % 24}h`;
  if (hours > 0) return `in ${hours}h ${mins}m`;
  return `in ${mins}m`;
}
