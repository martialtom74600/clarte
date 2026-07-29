"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { clarte, clarteFocusRing } from "@/lib/clarte-design";
import { ArrowRight, Check } from "lucide-react";
import { duration, ease, spring, scaleTap } from "@/lib/motion";

interface WizardStepContainerProps {
  step: number;
  children: React.ReactNode;
}

export function WizardStepContainer({ step, children }: WizardStepContainerProps) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        initial={reduced ? { opacity: 0 } : { opacity: 0, x: 16, filter: "blur(4px)" }}
        animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, x: -16, filter: "blur(4px)" }}
        transition={{ duration: duration.normal, ease: ease.out }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

interface StepShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onNext?: () => void;
  onPrev?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showPrev?: boolean;
  conversion?: boolean;
}

export function StepShell({
  title,
  subtitle,
  children,
  onNext,
  onPrev,
  nextLabel = "Continuer",
  nextDisabled = false,
  showPrev = true,
  conversion = false,
}: StepShellProps) {
  return (
    <div>
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: duration.fast, ease: ease.out }}
        className="text-2xl font-bold tracking-tight text-slate-900"
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05, duration: duration.fast }}
          className="mt-2 text-slate-600"
        >
          {subtitle}
        </motion.p>
      )}
      <div className="mt-8">{children}</div>
      <div className="mt-8 flex items-center justify-between gap-4">
        {showPrev && onPrev ? (
          <button
            type="button"
            onClick={onPrev}
            className="rounded-full px-6 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100/80 transition-colors"
          >
            Retour
          </button>
        ) : (
          <div />
        )}
        {onNext && (
          <motion.button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            whileHover={!nextDisabled ? { scale: 1.02 } : undefined}
            whileTap={!nextDisabled ? { scale: 0.98 } : undefined}
            transition={spring.snappy}
            className={cn(
              "flex items-center gap-2 px-8 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40",
              clarte.btnPrimary,
              conversion && "shadow-lg shadow-brand-600/25"
            )}
          >
            {nextLabel}
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        )}
      </div>
    </div>
  );
}

interface InputFieldProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  optional?: boolean;
}

export function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
  optional,
}: InputFieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">
        {label}
        {optional && <span className="ml-2 font-normal text-slate-400">(optionnel)</span>}
      </span>
      <motion.input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        whileFocus={{ scale: 1.002 }}
        transition={spring.soft}
        className={cn(
          "mt-2 w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition-shadow",
          clarteFocusRing
        )}
      />
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </label>
  );
}

interface SelectCardProps {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

export function SelectCard({ label, description, selected, onClick }: SelectCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      {...scaleTap}
      className={cn(
        "w-full rounded-2xl border-2 p-5 text-left transition-colors",
        selected
          ? "border-brand-500 bg-brand-50/80 shadow-[0_0_0_3px_rgba(0,111,199,0.1)]"
          : "border-slate-200/80 bg-white/60 hover:border-brand-200 hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{label}</p>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={spring.snappy}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600"
          >
            <Check className="h-3.5 w-3.5 text-white" />
          </motion.div>
        )}
      </div>
    </motion.button>
  );
}
