"use client";

import { useId, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { clarte, clarteFocusRing } from "@/lib/clarte-design";
import { spring } from "@/lib/motion";
import { DrawCheck } from "./motion-primitives";

interface FloatingInputProps {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  validate?: (value: string) => boolean;
}

export function FloatingInput({
  label,
  type = "text",
  value,
  onChange,
  hint,
  validate,
}: FloatingInputProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const floated = focused || value.length > 0;
  const isValid = validate ? validate(value) : value.length > 0;

  return (
    <div>
      <div className="relative">
        <motion.input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn(
            "peer w-full rounded-xl border bg-white/80 px-4 pb-3 pt-6 text-slate-900 outline-none transition-shadow",
            focused ? cn("border-brand-400", clarteFocusRing) : "border-slate-200",
            isValid && value.length > 0 && "border-emerald-300"
          )}
          whileFocus={{ scale: 1.002 }}
          transition={spring.soft}
        />
        <motion.label
          htmlFor={id}
          className={cn(
            "pointer-events-none absolute left-4 text-slate-500 transition-colors",
            floated ? "top-2 text-xs" : "top-1/2 -translate-y-1/2 text-sm"
          )}
          animate={{
            color: focused ? "rgb(0, 111, 199)" : "rgb(100, 116, 139)",
          }}
          transition={spring.soft}
        >
          {label}
        </motion.label>
        {validate && isValid && value.length > 0 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <DrawCheck />
          </div>
        )}
      </div>
      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Input standard charte (labels au-dessus) */
export function ClarteInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
  optional,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
  optional?: boolean;
}) {
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
        className={cn("mt-2", clarte.input)}
      />
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </label>
  );
}
