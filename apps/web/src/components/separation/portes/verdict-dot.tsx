"use client";

import type { AffordabilityVerdict } from "@separation/schemas";
import { cn } from "@/lib/utils";

const VERDICT_STYLES: Record<
  AffordabilityVerdict,
  { dot: string; text: string; label: string }
> = {
  green: {
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    label: "Tenable",
  },
  orange: {
    dot: "bg-amber-500",
    text: "text-amber-700",
    label: "Serré",
  },
  red: {
    dot: "bg-rose-500",
    text: "text-rose-700",
    label: "Difficile",
  },
};

interface VerdictDotProps {
  verdict: AffordabilityVerdict;
  label?: string;
  className?: string;
}

export function VerdictDot({ verdict, label, className }: VerdictDotProps) {
  const style = VERDICT_STYLES[verdict];
  const displayLabel = label ?? style.label;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn("h-2.5 w-2.5 shrink-0 rounded-full", style.dot)}
        aria-hidden
      />
      <span className={cn("text-sm font-medium", style.text)}>{displayLabel}</span>
    </div>
  );
}
