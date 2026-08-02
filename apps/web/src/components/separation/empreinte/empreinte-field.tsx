"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { duration, ease } from "@/lib/motion";

export type EmpreinteFieldType = "postal" | "currency" | "number" | "rate";

interface EmpreinteFieldProps {
  stepKey: string;
  label: string;
  type: EmpreinteFieldType;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  hint?: string;
  whisper?: string;
  placeholder?: string;
  suffix?: string;
  autoFocus?: boolean;
  /** Si false, le bouton Continuer est désactivé. */
  canContinue?: boolean;
  /** Indicateur d'étape (ex. barre 1/6) rendu au-dessus du label. */
  progress?: ReactNode;
  onBack?: () => void;
}

function formatCurrencyDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("fr-FR");
}

function formatNumberDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return String(Number(digits));
}

function parseCurrency(raw: string | undefined): number {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function parseNumber(raw: string | undefined): number {
  const digits = (raw ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function sanitizeRateInput(raw: string): string {
  const cleaned = raw.replace(/[^\d,]/g, "").replace(".", ",");
  const comma = cleaned.indexOf(",");
  if (comma === -1) return cleaned;
  return cleaned.slice(0, comma + 1) + cleaned.slice(comma + 1).replace(/,/g, "");
}

function sanitizeInput(type: EmpreinteFieldType, next: string): string {
  if (type === "postal") return next.replace(/\D/g, "").slice(0, 5);
  if (type === "number") return formatNumberDisplay(next);
  if (type === "rate") return sanitizeRateInput(next);
  return formatCurrencyDisplay(next);
}

/** Champ compact pour les écrans multi-champs (patrimoine / financement). */
export function EmpreinteFormRow({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  suffix,
  hint,
  autoFocus = false,
  inputRef,
}: {
  id: string;
  label: string;
  type: EmpreinteFieldType;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suffix?: string;
  hint?: string;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const localRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? localRef;

  useEffect(() => {
    if (!autoFocus) return;
    const t = window.setTimeout(() => ref.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [autoFocus, ref]);

  return (
    <div className="w-full text-left">
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-500">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(sanitizeInput(type, e.target.value))}
          className={cn(
            "w-full border-0 border-b border-slate-300/80 bg-transparent pb-2.5 pr-12",
            "text-2xl font-light tracking-tight text-slate-900 placeholder:text-slate-300",
            "outline-none transition-colors focus:border-brand-500/60",
            "md:text-3xl"
          )}
        />
        {suffix && (
          <span
            className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-lg font-light text-slate-400"
            aria-hidden
          >
            {suffix}
          </span>
        )}
        {type === "currency" && value && !suffix && (
          <span
            className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-lg font-light text-slate-400"
            aria-hidden
          >
            €
          </span>
        )}
      </div>
      {hint && <p className="mt-2 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function EmpreinteStepNav({
  onBack,
  onContinue,
  canContinue = true,
  continueAlwaysEnabled = false,
  className,
}: {
  onBack?: () => void;
  onContinue: () => void;
  canContinue?: boolean;
  /** Financement : le bouton reste cliquable, la validation s'exécute au clic. */
  continueAlwaysEnabled?: boolean;
  className?: string;
}) {
  const continueDisabled = continueAlwaysEnabled ? false : !canContinue;

  return (
    <div className={cn("mt-20 flex w-full flex-col items-center gap-5 sm:mt-24", className)}>
      <button
        type="button"
        onClick={onContinue}
        disabled={continueDisabled}
        className={cn(
          "group text-sm font-medium transition-colors",
          continueDisabled
            ? "cursor-not-allowed text-slate-300"
            : "text-slate-500 hover:text-brand-600"
        )}
      >
        Continuer
        <span
          className={cn(
            "ml-1 inline-block transition-transform",
            !continueDisabled && "group-hover:translate-x-0.5"
          )}
        >
          →
        </span>
      </button>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition-colors hover:text-slate-600"
        >
          <ArrowLeft
            className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
            aria-hidden
          />
          Retour
        </button>
      )}
    </div>
  );
}

/** @deprecated Préférez EmpreinteStepNav pour la navigation Retour / Continuer. */
export function EmpreinteContinueButton({
  onClick,
  disabled,
  className,
}: {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <EmpreinteStepNav
      onContinue={onClick}
      canContinue={!disabled}
      className={className}
    />
  );
}

/** Écran mono-champ (localisation / revenus) — hérite du rythme d'origine. */
export function EmpreinteField({
  stepKey,
  label,
  type,
  value,
  onChange,
  onSubmit,
  hint,
  whisper,
  placeholder,
  suffix,
  autoFocus = true,
  canContinue = true,
  progress,
  onBack,
}: EmpreinteFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!autoFocus) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), reduced ? 0 : 120);
    return () => window.clearTimeout(t);
  }, [stepKey, autoFocus, reduced]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canContinue) {
      e.preventDefault();
      onSubmit();
    }
  };

  const showSuffix = Boolean(suffix) && (type === "number" || Boolean(value));
  const currencySuffix = type === "currency" && value && !suffix;

  return (
    <motion.div
      key={stepKey}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
      transition={{ duration: duration.slow, ease: ease.out }}
      className="mx-auto flex w-full max-w-xl flex-col items-center text-center"
    >
      {progress}
      <p className="mb-10 text-sm font-medium tracking-wide text-slate-400">{label}</p>

      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(sanitizeInput(type, e.target.value))}
          onKeyDown={handleKeyDown}
          aria-label={label}
          className={cn(
            "w-full border-0 border-b border-slate-300/80 bg-transparent pb-3 text-center",
            "text-4xl font-light tracking-tight text-slate-900 placeholder:text-slate-300",
            "outline-none transition-colors focus:border-brand-500/60",
            "md:text-5xl lg:text-6xl"
          )}
        />
        {(currencySuffix || showSuffix) && (
          <span
            className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-2xl font-light text-slate-400 md:text-3xl"
            aria-hidden
          >
            {suffix ?? "€"}
          </span>
        )}
      </div>

      {whisper && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 text-sm text-slate-500"
        >
          {whisper}
        </motion.p>
      )}

      {hint && <p className="mt-4 text-xs text-slate-400">{hint}</p>}

      <EmpreinteStepNav onBack={onBack} onContinue={() => onSubmit()} canContinue={canContinue} />
    </motion.div>
  );
}

export { parseCurrency, parseNumber, sanitizeInput, formatCurrencyDisplay, formatNumberDisplay };
