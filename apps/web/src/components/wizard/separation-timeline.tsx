"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { spring } from "@/lib/motion";

export const TIMELINE_STEPS = [
  { id: 0, label: "Cadre", desc: "Statut juridique" },
  { id: 1, label: "Le bien", desc: "Logement commun" },
  { id: 2, label: "Les parties", desc: "Vous & autre" },
  { id: 3, label: "Révélation", desc: "Projection complète" },
  { id: 4, label: "Agir", desc: "Sécuriser & options" },
] as const;

export const WIZARD_MAX_STEP = TIMELINE_STEPS.length - 1;

interface SeparationTimelineProps {
  currentStep: number;
  isActComplete: (actId: number) => boolean;
}

export function SeparationTimeline({ currentStep, isActComplete }: SeparationTimelineProps) {
  const step = Math.min(currentStep, WIZARD_MAX_STEP);

  return (
    <div className="mb-2">
      <div className="hidden md:flex items-center justify-between gap-1">
        {TIMELINE_STEPS.map((s) => {
          const done = isActComplete(s.id) && s.id < step;
          const active = step === s.id;
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
          Acte {step + 1}/{TIMELINE_STEPS.length} — {TIMELINE_STEPS[step]?.label}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/80">
          <motion.div
            className="h-full rounded-full bg-brand-600"
            initial={false}
            animate={{ width: `${((step + 1) / TIMELINE_STEPS.length) * 100}%` }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>
    </div>
  );
}
