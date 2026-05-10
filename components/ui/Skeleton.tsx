import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  height?: string | number;
  width?: string | number;
}

export function Skeleton({ className, height, width, style, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-shimmer", className)}
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        width: typeof width === "number" ? `${width}px` : width,
        ...style,
      }}
      {...props}
    />
  );
}

export function BetCardSkeleton() {
  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Skeleton height={20} width={64} />
        <Skeleton height={20} width={80} />
      </div>
      <div className="flex flex-col gap-2">
        <Skeleton height={18} className="w-full" />
        <Skeleton height={18} className="w-3/4" />
      </div>
      <Skeleton height={4} className="w-full" />
      <div className="flex items-center justify-between">
        <Skeleton height={14} width={80} />
        <Skeleton height={14} width={60} />
      </div>
    </div>
  );
}

export function EvidenceLogSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center gap-1 pt-1">
            <Skeleton height={8} width={8} className="rounded-full" />
            <div className="w-0.5 flex-1 bg-[var(--border)]" />
          </div>
          <div className="flex-1 flex flex-col gap-3 pb-6">
            <Skeleton height={14} width={120} />
            <Skeleton height={12} width={200} />
            <Skeleton height={12} className="w-full" />
            <Skeleton height={12} className="w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
