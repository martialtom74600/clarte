"use client";

import { useReducedMotion } from "framer-motion";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { clarte } from "@/lib/clarte-design";
import { cn, formatEuro } from "@/lib/utils";
import type { LabLedgerModel } from "@/lib/separation/lab-ledger-model";
import { ledgerFingerprint } from "@/lib/separation/lab-ledger-model";
import { VerdictDot } from "@/components/separation/portes/verdict-dot";

interface LabLedgerProps {
  model: LabLedgerModel | null;
  className?: string;
}

function LedgerRow({ line }: { line: LabLedgerModel["lines"][number] }) {
  const prefix = line.tone === "subtract" ? "−" : "";

  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 rounded-lg px-2 py-2 -mx-2",
        line.tone === "total" && "border-t border-slate-200/80 pt-4 mt-2"
      )}
    >
      <span
        className={cn(
          "text-sm text-slate-600",
          line.tone === "total" && "font-medium text-slate-900"
        )}
      >
        {line.label}
      </span>
      <span
        className={cn(
          "tabular-nums text-sm text-slate-900",
          line.tone === "highlight" && "font-medium",
          line.tone === "total" && "text-lg font-light"
        )}
      >
        {prefix}
        {formatEuro(line.amount)}
        {line.suffix ?? ""}
      </span>
    </div>
  );
}

export function LabLedger({ model, className }: LabLedgerProps) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const pulseKey = ledgerFingerprint(model);

  if (!model) {
    return (
      <div className={cn("flex min-h-[200px] items-center justify-center", className)}>
        <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200/80" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Votre calcul</p>
        <h2 className="mt-2 text-2xl font-light tracking-tight text-slate-900">{model.doorTitle}</h2>
        {model.verdict && (
          <VerdictDot
            verdict={model.verdict.verdict}
            label={model.verdict.headline}
            className="mt-4"
          />
        )}
      </div>

      <motion.div
        key={pulseKey}
        initial={reduced ? false : { backgroundColor: "rgba(0,111,199,0.08)" }}
        animate={{ backgroundColor: "rgba(0,111,199,0)" }}
        transition={{ duration: 0.65 }}
        className="space-y-1 rounded-xl"
      >
        {model.lines.map((line) => (
          <LedgerRow key={line.id} line={line} />
        ))}
      </motion.div>

      {model.footer && (
        <div className="mt-8 space-y-2 text-xs leading-relaxed text-slate-500">
          {model.footer.split("\n").map((line) => (
            <p
              key={line}
              className={
                line.includes("HCSF")
                  ? "font-medium text-slate-700"
                  : undefined
              }
            >
              {line}
            </p>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => router.push("/simulation/export")}
        className={cn(clarte.btnPrimary, "mt-10 w-full py-3.5 text-sm")}
      >
        Exporter ce bilan
      </button>
    </div>
  );
}
