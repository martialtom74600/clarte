"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CircleCheck, FileText } from "lucide-react";
import { clarteGlassCard } from "@/lib/clarte-design";
import type { DossierLine } from "@/lib/dossier-progress";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

interface DossierLivePanelProps {
  percent: number;
  lines: DossierLine[];
  currentStep: number;
  revealed?: boolean;
}

export function DossierLivePanel({
  percent,
  lines,
  currentStep,
  revealed = false,
}: DossierLivePanelProps) {
  const reduced = useReducedMotion();

  return (
    <motion.aside
      initial={reduced ? false : { opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={spring.soft}
      className="hidden lg:block"
    >
      <div className={cn(clarteGlassCard, "sticky top-8 border-slate-200/80 p-5")}>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <FileText className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Dossier Clarté
            </p>
            <p className="text-sm font-medium text-slate-900">
              {revealed ? "Révélé" : `${percent} % constitué`}
            </p>
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/80">
          <motion.div
            className="h-full rounded-full bg-brand-600"
            initial={false}
            animate={{ width: `${revealed ? 100 : percent}%` }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        <ul className="mt-5 space-y-3">
          {lines.map((line, index) => (
            <motion.li
              key={line.id}
              layout
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, ...spring.soft }}
              className="flex items-start gap-2.5"
            >
              <div
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  line.complete
                    ? "bg-emerald-100 text-emerald-700"
                    : currentStep >= index
                      ? "bg-brand-100 text-brand-600"
                      : "bg-slate-100 text-slate-400"
                )}
              >
                {line.complete ? (
                  <CircleCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    line.complete ? "text-slate-900" : "text-slate-500"
                  )}
                >
                  {line.label}
                </p>
                <p className="truncate text-xs text-slate-500">{line.detail}</p>
              </div>
            </motion.li>
          ))}
        </ul>

        {revealed && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800"
          >
            Dossier complet — projection calculée sur l&apos;ensemble de vos données.
          </motion.p>
        )}
      </div>
    </motion.aside>
  );
}

/** Barre compacte mobile reprenant le % du dossier. */
export function DossierMobileProgress({ percent, revealed }: { percent: number; revealed?: boolean }) {
  return (
    <div className="mb-4 lg:hidden">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Dossier Clarté</span>
        <span>{revealed ? "Complet" : `${percent} %`}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200/80">
        <motion.div
          className="h-full rounded-full bg-brand-600"
          initial={false}
          animate={{ width: `${revealed ? 100 : percent}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </div>
  );
}
