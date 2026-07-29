"use client";

import { cn } from "@/lib/utils";
import { Check, Circle } from "lucide-react";

const TIMELINE_STEPS = [
  { id: 0, label: "Comprendre", desc: "Statut & situation" },
  { id: 1, label: "Estimer", desc: "Logement & patrimoine" },
  { id: 2, label: "Visualiser", desc: "Soulte & répartition" },
  { id: 3, label: "Affiner", desc: "Budget & enfants" },
  { id: 4, label: "Choisir", desc: "Scénarios" },
  { id: 5, label: "Sécuriser", desc: "Rapport horodaté" },
  { id: 6, label: "Agir", desc: "Pro & clôture" },
];

interface SeparationTimelineProps {
  currentStep: number;
}

export function SeparationTimeline({ currentStep }: SeparationTimelineProps) {
  const timelineStep = stepToTimeline(currentStep);

  return (
    <div className="mb-8">
      <div className="hidden md:flex items-center justify-between gap-1">
        {TIMELINE_STEPS.map((s, i) => {
          const done = timelineStep > s.id;
          const active = timelineStep === s.id;
          return (
            <div key={s.id} className="flex flex-1 flex-col items-center text-center">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                  done && "border-emerald-500 bg-emerald-500 text-white",
                  active && !done && "border-brand-600 bg-brand-50 text-brand-700",
                  !done && !active && "border-slate-200 bg-white text-slate-400"
                )}
              >
                {done ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3 fill-current" />}
              </div>
              <p className={cn("mt-2 text-xs font-medium", active ? "text-brand-700" : "text-slate-600")}>
                {s.label}
              </p>
              {i < TIMELINE_STEPS.length - 1 && (
                <div className="absolute hidden" />
              )}
            </div>
          );
        })}
      </div>
      <div className="md:hidden">
        <p className="text-sm text-slate-500">
          Étape {timelineStep + 1}/{TIMELINE_STEPS.length} — {TIMELINE_STEPS[timelineStep]?.label}
        </p>
        <div className="mt-2 h-1.5 rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${((timelineStep + 1) / TIMELINE_STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function stepToTimeline(wizardStep: number): number {
  if (wizardStep <= 0) return 0;
  if (wizardStep <= 1) return 1;
  if (wizardStep <= 2) return 2;
  if (wizardStep <= 3) return 3;
  if (wizardStep <= 4) return 4;
  if (wizardStep <= 5) return 5;
  return 6;
}

export { TIMELINE_STEPS };
