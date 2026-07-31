"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { duration, ease } from "@/lib/motion";

export type EmpreinteFieldType = "postal" | "currency" | "number";

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

function parseCurrency(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function parseNumber(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

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
}: EmpreinteFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!autoFocus) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), reduced ? 0 : 120);
    return () => window.clearTimeout(t);
  }, [stepKey, autoFocus, reduced]);

  const handleChange = (next: string) => {
    if (type === "postal") {
      onChange(next.replace(/\D/g, "").slice(0, 5));
      return;
    }
    if (type === "number") {
      onChange(formatNumberDisplay(next));
      return;
    }
    onChange(formatCurrencyDisplay(next));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit();
    }
  };

  const showSuffix = Boolean(suffix) && (type === "number" || (type === "currency" && value));
  const currencySuffix = type === "currency" && value && !suffix;

  return (
    <motion.div
      key={stepKey}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
      transition={{ duration: duration.slow, ease: ease.out }}
      className="flex w-full max-w-xl flex-col items-center text-center"
    >
      <p className="mb-10 text-sm font-medium tracking-wide text-slate-400">{label}</p>

      <div className="relative w-full">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => handleChange(e.target.value)}
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

      <button
        type="button"
        onClick={onSubmit}
        className="group mt-14 text-sm font-medium text-slate-500 transition-colors hover:text-brand-600"
      >
        Continuer
        <span className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </button>
    </motion.div>
  );
}

export { parseCurrency, parseNumber };
