"use client";

import { useEffect, useState } from "react";
import type { AffordabilityVerdict } from "@separation/schemas";
import { cn } from "@/lib/utils";
import type { LabLedgerModel } from "@/lib/separation/lab-ledger-model";
import {
  debtThresholdMessage,
  HCSF_DEBT_CEILING_PCT,
  parseFooterBlocks,
  shouldOpenLedgerInsights,
} from "@/lib/separation/lab-ledger-insights";

const VERDICT_PANEL: Record<
  AffordabilityVerdict,
  { border: string; bg: string; text: string; label: string }
> = {
  green: {
    border: "border-emerald-200",
    bg: "bg-emerald-50/90",
    text: "text-emerald-900",
    label: "Tenable",
  },
  orange: {
    border: "border-amber-200",
    bg: "bg-amber-50/90",
    text: "text-amber-950",
    label: "Serré",
  },
  red: {
    border: "border-rose-200",
    bg: "bg-rose-50/90",
    text: "text-rose-950",
    label: "Difficile",
  },
};

function contextNoteStyles(verdict: LabLedgerModel["verdict"]) {
  switch (verdict?.verdict) {
    case "green":
      return "border-emerald-200 bg-emerald-50/80 text-emerald-950";
    case "orange":
      return "border-amber-200 bg-amber-50/80 text-amber-950";
    case "red":
      return "border-rose-200 bg-rose-50/80 text-rose-950";
    default:
      return "border-slate-200 bg-slate-50/80 text-slate-800";
  }
}

export function LedgerFooterInsights({
  ledger,
}: {
  ledger: LabLedgerModel;
}) {
  const { footer, verdict, contextNote, warningNote, doorId } = ledger;
  if (!footer && !contextNote) return null;

  const { debtLine, debtPct, relocateLine, negativeEquityLine, otherLines } = footer
    ? parseFooterBlocks(footer)
    : {
        debtLine: undefined,
        debtPct: null,
        relocateLine: undefined,
        negativeEquityLine: undefined,
        otherLines: [] as string[],
      };
  const panel = verdict ? VERDICT_PANEL[verdict.verdict] : null;
  const debtThreshold = debtThresholdMessage(debtPct, doorId);
  const [insightsOpen, setInsightsOpen] = useState(false);

  useEffect(() => {
    setInsightsOpen(shouldOpenLedgerInsights(verdict?.verdict));
  }, [verdict?.verdict]);

  return (
    <>
      <details
        open={insightsOpen}
        onToggle={(e) => setInsightsOpen(e.currentTarget.open)}
        className="group mt-4 rounded-xl border border-slate-200/80 bg-white/50"
      >
        <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-medium text-slate-600 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            Ce que ça signifie
            <span className="text-slate-400 transition-transform group-open:rotate-180">▾</span>
          </span>
        </summary>
        <div className="space-y-2 border-t border-slate-200/60 px-3 py-3">
          {negativeEquityLine && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/90 px-3 py-2">
              <p className="text-xs font-medium text-rose-950">{negativeEquityLine}</p>
            </div>
          )}

          {debtLine && panel && (
            <div className={cn("rounded-lg border px-3 py-2.5", panel.border, panel.bg)}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Endettement bancaire
                  </p>
                  {debtPct != null && (
                    <p className={cn("mt-0.5 text-xl font-light tabular-nums", panel.text)}>
                      {debtPct} %
                    </p>
                  )}
                  <p className={cn("mt-1 text-xs leading-relaxed", panel.text)}>{debtLine}</p>
                  {debtThreshold && (
                    <p className={cn("mt-2 text-xs font-medium leading-relaxed", panel.text)}>
                      {debtThreshold}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                    Calcul : mensualités totales ÷ revenus nets mensuels (plafond HCSF{" "}
                    {HCSF_DEBT_CEILING_PCT} %).
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                    panel.border,
                    panel.bg,
                    panel.text
                  )}
                >
                  {panel.label}
                </span>
              </div>
            </div>
          )}

          {relocateLine && (
            <div className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Relogement
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-700">{relocateLine}</p>
            </div>
          )}

          {otherLines.map((line, index) => (
            <p
              key={`insight-${index}-${line.slice(0, 24)}`}
              className="text-xs leading-relaxed text-slate-500"
            >
              {line}
            </p>
          ))}

          {contextNote && (
            <p
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-medium leading-relaxed",
                contextNoteStyles(verdict)
              )}
            >
              {contextNote}
            </p>
          )}
        </div>
      </details>

      {warningNote && (
        <p
          className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-950"
          role="note"
        >
          <span className="font-medium">Banque : </span>
          {warningNote}
        </p>
      )}
    </>
  );
}
