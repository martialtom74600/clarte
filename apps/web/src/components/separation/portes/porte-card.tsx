"use client";

import type { DoorId } from "@separation/schemas";
import { cn } from "@/lib/utils";
import type { PortePresentation } from "@/lib/separation/porte-presenter";
import { VerdictDot } from "./verdict-dot";

interface PorteCardProps {
  porte: PortePresentation;
  onOpen: (doorId: DoorId) => void;
  featured?: boolean;
  className?: string;
}

const RELOCATE_DOT: Record<string, string> = {
  green: "bg-emerald-500",
  orange: "bg-amber-500",
  red: "bg-rose-500",
};

export function PorteCard({ porte, onOpen, featured = false, className }: PorteCardProps) {
  const bilateral = porte.bilateral;

  return (
    <button
      type="button"
      onClick={() => onOpen(porte.doorId)}
      className={cn(
        "group relative flex w-full flex-col text-left",
        "rounded-2xl border bg-white/50 transition-all duration-300 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-2",
        featured
          ? "min-h-[220px] border-brand-300/80 bg-white/80 p-6 shadow-[0_8px_32px_rgba(0,111,199,0.08)] md:min-h-[260px] md:p-8"
          : "min-h-[180px] border-slate-200/80 p-5 hover:border-slate-300 hover:bg-white/75 md:min-h-[220px] md:p-6",
        "hover:scale-[1.01]",
        className
      )}
    >
      {featured && (
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-brand-600">
          Piste à explorer en premier
        </p>
      )}

      <div className="flex items-start justify-between gap-3">
        <h3
          className={cn(
            "font-medium tracking-tight text-slate-900",
            featured ? "text-xl md:text-2xl" : "text-base md:text-lg"
          )}
        >
          {porte.title}
        </h3>
        <VerdictDot verdict={porte.verdict} label={porte.verdictLabel} />
      </div>

      {/* Mobile compact : montant principal + légende */}
      <div className="mt-4 flex items-baseline justify-between gap-3 md:hidden">
        <div>
          <p className="text-3xl font-light tracking-tight text-slate-900">{porte.heroValue}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-slate-400">
            {porte.heroCaption}
          </p>
        </div>
      </div>

      {/* Desktop : bilatéral ou hero */}
      <div className="mt-5 hidden flex-1 flex-col justify-center md:flex">
        {bilateral && bilateral.length === 2 ? (
          <div className="grid grid-cols-2 gap-0 divide-x divide-slate-200/80">
            {bilateral.map((side) => (
              <div key={side.personKey} className="px-3 first:pl-0 last:pr-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  {side.personLabel}
                </p>
                <p className="mt-1.5 text-2xl font-light tracking-tight text-slate-900">
                  {side.amount}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-slate-500">{side.caption}</p>
                {side.relocateLabel && (
                  <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-600">
                    <span
                      className={cn(
                        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                        RELOCATE_DOT[side.relocateVerdict ?? "orange"] ?? "bg-slate-400"
                      )}
                    />
                    {side.relocateLabel}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div>
            <p className="text-4xl font-light tracking-tight text-slate-900">{porte.heroValue}</p>
            <p className="mt-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">
              {porte.heroCaption}
            </p>
          </div>
        )}
      </div>

      <p
        className={cn(
          "mt-4 text-sm leading-relaxed text-slate-600",
          !featured && "line-clamp-2 md:line-clamp-none"
        )}
      >
        {porte.consequence}
      </p>

      <p className="mt-4 text-xs font-medium text-brand-700 opacity-0 transition-opacity duration-200 group-hover:opacity-100 md:mt-auto md:pt-4">
        Affiner ce chemin →
      </p>
    </button>
  );
}
