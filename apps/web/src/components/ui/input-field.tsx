"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { clarteFocusRing } from "@/lib/clarte-design";
import { spring } from "@/lib/motion";

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
