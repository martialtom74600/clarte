"use client";

import { ShimmerSkeleton } from "@/components/ui";
import { clarteGlassCard } from "@/lib/clarte-design";

export function LeadWallSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={`${clarteGlassCard} p-6 space-y-4`}>
          <div className="flex justify-between">
            <ShimmerSkeleton className="h-4 w-32" />
            <ShimmerSkeleton className="h-6 w-16 rounded-full" />
          </div>
          <ShimmerSkeleton className="h-3 w-full" />
          <ShimmerSkeleton className="h-3 w-2/3" />
          <div className="flex gap-2 pt-2">
            <ShimmerSkeleton className="h-3 w-20" />
            <ShimmerSkeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
