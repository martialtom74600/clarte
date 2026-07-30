"use client";

import type { DoorId } from "@separation/schemas";
import { cn } from "@/lib/utils";
import type { PortePresentation } from "@/lib/separation/porte-presenter";
import { VerdictDot } from "./verdict-dot";

interface PorteCardProps {
  porte: PortePresentation;
  onOpen: (doorId: DoorId) => void;
  className?: string;
}

export function PorteCard({ porte, onOpen, className }: PorteCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(porte.doorId)}
      className={cn(
        "group flex min-h-[280px] w-full flex-col rounded-2xl border border-slate-200/90 bg-white/40 p-6 text-left",
        "transition-all duration-300 ease-out",
        "hover:scale-[1.01] hover:border-slate-300 hover:bg-white/70",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-2",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-medium tracking-tight text-slate-900 md:text-xl">
          {porte.title}
        </h2>
        <VerdictDot verdict={porte.verdict} label={porte.verdictLabel} />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <p className="text-4xl font-light tracking-tight text-slate-900 md:text-5xl">
          {porte.heroValue}
        </p>
        <p className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-400">
          {porte.heroCaption}
        </p>
      </div>

      <p className="text-sm leading-relaxed text-slate-600">{porte.consequence}</p>
    </button>
  );
}
