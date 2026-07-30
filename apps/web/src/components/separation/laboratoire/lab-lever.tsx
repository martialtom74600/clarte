"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { duration, ease } from "@/lib/motion";

interface LabLeverProps {
  title: string;
  description?: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children?: React.ReactNode;
}

/** Switch pill type Tailwind UI / shadcn — thumb centré, pas d’absolute. */
function LeverSwitch({
  enabled,
  onToggle,
  labelledBy,
}: {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  labelledBy: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-labelledby={labelledBy}
      onClick={() => onToggle(!enabled)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full",
        "border-2 border-transparent transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2",
        enabled ? "bg-brand-600" : "bg-slate-200"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none inline-block size-5 rounded-full bg-white shadow-sm",
          "transform transition-transform duration-200 ease-out",
          enabled ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

export function LabLever({
  title,
  description,
  enabled,
  onToggle,
  children,
}: LabLeverProps) {
  const reduced = useReducedMotion();
  const titleId = `lever-title-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white/50">
      <div className="p-5">
        <div className="flex items-center justify-between gap-4">
          <p id={titleId} className="min-w-0 flex-1 text-base font-medium leading-6 text-slate-900">
            {title}
          </p>
          <LeverSwitch enabled={enabled} onToggle={onToggle} labelledBy={titleId} />
        </div>
        {description && (
          <p className="mt-1.5 pr-14 text-sm leading-relaxed text-slate-500">{description}</p>
        )}
      </div>

      <motion.div
        initial={false}
        animate={{
          height: enabled ? "auto" : 0,
          opacity: enabled ? 1 : 0,
        }}
        transition={
          reduced
            ? { duration: 0 }
            : { duration: duration.normal, ease: ease.out }
        }
        className="overflow-hidden"
      >
        <div className="border-t border-slate-200/80 px-5 pb-5 pt-4">{children}</div>
      </motion.div>
    </div>
  );
}

interface LabFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  suffix?: string;
}

export function LabField({ label, value, onChange, hint, suffix }: LabFieldProps) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="relative mt-2">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-slate-900 outline-none transition-colors focus:border-brand-400"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </label>
  );
}
