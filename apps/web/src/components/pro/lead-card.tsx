"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Flame, Lock, ArrowRight } from "lucide-react";
import { scenarioLabel, tierLabel } from "@separation/marketplace";
import type { LeadPreview } from "@separation/marketplace";
import { complexityDots, isLeadHot } from "@/lib/lead-utils";
import { clarte, clarteGlassCard } from "@/lib/clarte-design";
import { cn } from "@/lib/utils";
import { scaleTap, spring } from "@/lib/motion";

interface LeadCardProps {
  leadId: string;
  preview: LeadPreview;
  creditPrice: number;
}

export function LeadCard({ leadId, preview, creditPrice }: LeadCardProps) {
  const hot = isLeadHot(preview);
  const dots = complexityDots(preview.complexity_score);

  const tierStyles = {
    hot: "bg-rose-500/10 text-rose-700 border-rose-200/60",
    warm: "bg-amber-500/10 text-amber-700 border-amber-200/60",
    cold: "bg-slate-500/10 text-slate-600 border-slate-200/60",
  };

  return (
    <motion.div layout layoutId={`lead-card-${leadId}`} {...scaleTap}>
      <Link href={`/pro/leads/${leadId}`} className="block group">
        <div
          className={cn(
            clarteGlassCard,
            "p-6 transition-shadow duration-200",
            clarte.cardHover,
            hot && `border-amber-400/50 ${clarte.hotPulse}`
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              {hot && (
                <motion.span
                  className="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-amber-600"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Flame className="h-3 w-3" />
                  Hot
                </motion.span>
              )}
              <p className="text-sm text-slate-500">
                Dept. {preview.dept} · {preview.postal_code_prefix}
              </p>
              <p className="mt-1 font-semibold capitalize text-slate-900">
                {preview.status_relationship}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                tierStyles[preview.tier]
              )}
            >
              {tierLabel(preview.tier)}
            </span>
          </div>

          <div className="mt-4 flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <motion.span
                key={i}
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  i < dots ? "bg-brand-600" : "bg-slate-200"
                )}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ ...spring.soft, delay: i * 0.08 }}
              />
            ))}
            <span className="ml-2 text-xs text-slate-500">
              Complexité {preview.complexity_score}/100
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
            <div>
              Immo :{" "}
              <strong>{preview.has_real_estate ? preview.property_value_range : "Non"}</strong>
            </div>
            <div>
              Scénario : <strong>{scenarioLabel(preview.scenario)}</strong>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
            <Lock className="h-3 w-3" />
            <span className="blur-[2px]">contact@••••.fr</span>
            <span>· débloquable</span>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100/80 pt-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-slate-400">
                Exclusif · 1 acheteur max
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Expire dans {preview.expires_in_days}j
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-brand-700">
                {creditPrice} crédit{creditPrice > 1 ? "s" : ""}
              </span>
              <ArrowRight className="h-4 w-4 text-brand-600 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
