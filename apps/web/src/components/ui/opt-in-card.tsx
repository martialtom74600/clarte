"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { clarteGlassCard } from "@/lib/clarte-design";
import { spring } from "@/lib/motion";

interface OptInCardProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
}

export function OptInCard({ checked, onChange, title, description }: OptInCardProps) {
  return (
    <motion.button
      type="button"
      onClick={() => onChange(!checked)}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      transition={spring.soft}
      className={cn(
        "w-full border-2 p-5 text-left transition-colors",
        clarteGlassCard,
        checked
          ? "border-brand-500 bg-brand-50/80 shadow-[0_0_0_3px_rgba(0,111,199,0.12)]"
          : "border-slate-200/80 hover:border-brand-200"
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
            checked ? "border-brand-600 bg-brand-600" : "border-slate-300 bg-white"
          )}
        >
          {checked && <Check className="h-3 w-3 text-white" />}
        </div>
        <div>
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
      </div>
    </motion.button>
  );
}
