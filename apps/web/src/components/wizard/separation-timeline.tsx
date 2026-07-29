"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { spring } from "@/lib/motion";

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
    <div className="mb-2">
      <div className="hidden md:flex items-center justify-between gap-1">
        {TIMELINE_STEPS.map((s) => {
          const done = timelineStep > s.id;
          const active = timelineStep === s.id;
          return (
            <div key={s.id} className="flex flex-1 flex-col items-center text-center">
              <motion.div
                layout
                transition={spring.soft}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                  done && "border-emerald-500 bg-emerald-500 text-white",
                  active && !done && "border-brand-600 bg-brand-50 text-brand-700 shadow-[0_0_0_3px_rgba(0,111,199,0.15)]",
                  !done && !active && "border-slate-200 bg-white/80 text-slate-400"
                )}
              >
                {done ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring.snappy}>
                    <Check className="h-4 w-4" />
                  </motion.div>
                ) : (
                  <span className="h-2 w-2 rounded-full bg-current" />
                )}
              </motion.div>
              <p
                className={cn(
                  "mt-2 text-xs font-medium",
                  active ? "text-brand-700" : "text-slate-500"
                )}
              >
                {s.label}
              </p>
            </div>
          );
        })}
      </div>
      <div className="md:hidden">
        <p className="text-sm text-slate-500">
          Étape {timelineStep + 1}/{TIMELINE_STEPS.length} — {TIMELINE_STEPS[timelineStep]?.label}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/80">
          <motion.div
            className="h-full rounded-full bg-brand-600"
            initial={false}
            animate={{ width: `${((timelineStep + 1) / TIMELINE_STEPS.length) * 100}%` }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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
