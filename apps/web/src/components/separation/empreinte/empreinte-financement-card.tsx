"use client";

import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { duration, ease } from "@/lib/motion";

interface FinancementModeOptionProps {
  selected: boolean;
  onSelect: () => void;
  icon: LucideIcon;
  title: string;
}

/** Ligne de sélection compacte — alignée sur le rythme des écrans Empreinte. */
export function FinancementModeOption({
  selected,
  onSelect,
  icon: Icon,
  title,
}: FinancementModeOptionProps) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      layout="position"
      transition={{ duration: duration.normal, ease: ease.out }}
      className={cn(
        "flex w-full items-center gap-3 border-b border-slate-200/80 py-3.5 text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 focus-visible:ring-offset-2",
        selected ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
      )}
    >
      <motion.span
        aria-hidden
        animate={{
          backgroundColor: selected ? "rgb(219 234 254)" : "rgb(241 245 249 / 0.8)",
          color: selected ? "rgb(29 78 216)" : "rgb(148 163 184)",
        }}
        transition={{ duration: duration.normal, ease: ease.out }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </motion.span>
      <span className="flex-1 text-sm font-medium leading-snug tracking-tight">{title}</span>
      <motion.span
        aria-hidden
        animate={{
          scale: selected ? 1 : 0.85,
          backgroundColor: selected ? "rgb(0 111 199)" : "rgb(255 255 255 / 0)",
          borderColor: selected ? "rgb(0 111 199)" : "rgb(203 213 225)",
        }}
        transition={{ duration: duration.normal, ease: ease.out }}
        className="h-4 w-4 shrink-0 rounded-full border-2"
      />
    </motion.button>
  );
}
