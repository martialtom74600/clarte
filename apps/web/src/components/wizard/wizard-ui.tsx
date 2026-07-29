"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS = [
  "Statut",
  "Logement",
  "Résultat",
  "Patrimoine",
  "Scénarios",
  "Rapport",
  "Qualification",
  "Match pro",
];

interface ProgressBarProps {
  currentStep: number;
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-500">
          Étape {currentStep + 1} sur {STEPS.length}
        </span>
        <span className="text-sm font-medium text-brand-600">
          {STEPS[currentStep]}
        </span>
      </div>
      <div className="flex gap-1">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i <= currentStep ? "bg-brand-600" : "bg-slate-200"
            )}
          />
        ))}
      </div>
    </div>
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
}: StepShellProps) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-2 text-slate-600">{subtitle}</p>}
      <div className="mt-8">{children}</div>
      <div className="mt-8 flex items-center justify-between gap-4">
        {showPrev && onPrev ? (
          <button
            type="button"
            onClick={onPrev}
            className="rounded-full px-6 py-3 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Retour
          </button>
        ) : (
          <div />
        )}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className="rounded-full bg-brand-600 px-8 py-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {nextLabel}
            <Check className="h-4 w-4" />
          </button>
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
        {optional && (
          <span className="ml-2 text-slate-400 font-normal">(optionnel)</span>
        )}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
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
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border-2 p-5 text-left transition-all card-hover",
        selected
          ? "border-brand-600 bg-brand-50"
          : "border-slate-200 bg-white hover:border-brand-200"
      )}
    >
      <p className="font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </button>
  );
}
