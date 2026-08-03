"use client";

import { useReducedMotion } from "framer-motion";
import { motion } from "framer-motion";
import { cn, formatEuro } from "@/lib/utils";
import type { LabLedgerModel, LedgerLine } from "@/lib/separation/lab-ledger-model";
import { ledgerFingerprint } from "@/lib/separation/lab-ledger-model";
import { linesForLedgerDetail, pickHeadlineLines } from "@/lib/separation/lab-ledger-parity";
import {
  groupLedgerLines,
  resolveLedgerSectionMeta,
  type LedgerSectionId,
} from "@/lib/separation/lab-ledger-sections";
import type { DoorId } from "@separation/schemas";
import { VerdictDot } from "@/components/separation/portes/verdict-dot";
import { LedgerFooterInsights } from "./ledger-footer-insights";

interface LabLedgerPanelProps {
  model: LabLedgerModel | null;
  className?: string;
}

function toneStyles(tone: LedgerLine["tone"]) {
  switch (tone) {
    case "subtract":
      return {
        badge: "−",
        badgeClass: "bg-rose-100 text-rose-700 ring-rose-200/80",
        amount: "text-rose-700",
        row: "hover:bg-rose-50/50",
      };
    case "highlight":
      return {
        badge: "=",
        badgeClass: "bg-brand-100 text-brand-800 ring-brand-200/80",
        amount: "font-semibold text-brand-900",
        row: "bg-brand-50/35",
      };
    case "total":
      return {
        badge: "∑",
        badgeClass: "bg-slate-900 text-white ring-slate-700/80",
        amount: "font-medium text-slate-900",
        row: "",
      };
    default:
      return {
        badge: "+",
        badgeClass: "bg-emerald-100 text-emerald-800 ring-emerald-200/80",
        amount: "text-slate-800",
        row: "",
      };
  }
}

function LedgerRow({ line, compact }: { line: LedgerLine; compact?: boolean }) {
  const styles = toneStyles(line.tone);
  const prefix = line.tone === "subtract" ? "−" : "";

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 px-2 py-2 -mx-0.5 transition-colors",
        styles.row
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {!compact && (
          <span
            className={cn(
              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-1",
              styles.badgeClass
            )}
            aria-hidden
          >
            {styles.badge}
          </span>
        )}
        <div className="min-w-0 text-left">
          <p
            className={cn(
              compact ? "text-xs" : "text-sm",
              "leading-snug",
              line.tone === "total" ? "font-semibold text-slate-900" : "font-medium text-slate-800"
            )}
          >
            {line.label}
          </p>
          {!compact && line.hint && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{line.hint}</p>
          )}
        </div>
      </div>
      <span className={cn("shrink-0 tabular-nums text-[15px] font-medium", styles.amount)}>
        {prefix}
        {formatEuro(line.amount)}
        {line.suffix ?? ""}
      </span>
    </div>
  );
}

function HeadlineChip({ line }: { line: LedgerLine }) {
  const prefix = line.tone === "subtract" ? "−" : "";
  return (
    <div className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200/90 shadow-sm shadow-slate-900/5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{line.label}</p>
      <p className="mt-0.5 tabular-nums text-lg font-semibold text-slate-900">
        {prefix}
        {formatEuro(line.amount)}
        {line.suffix ?? ""}
      </p>
    </div>
  );
}

function LedgerSectionBlock({
  sectionId,
  lines,
  doorId,
}: {
  sectionId: LedgerSectionId;
  lines: LedgerLine[];
  doorId: DoorId;
}) {
  if (lines.length === 0) return null;
  const meta = resolveLedgerSectionMeta(sectionId, doorId);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200/90 border-l-4 bg-white/90 shadow-sm shadow-slate-900/5",
        meta.border
      )}
    >
      <header className={cn("border-b border-slate-200/50 px-3.5 py-2.5", meta.bg)}>
        <h3 className={cn("text-sm font-semibold tracking-tight", meta.titleColor)}>{meta.title}</h3>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{meta.subtitle}</p>
      </header>
      <div className="px-2.5 py-1.5">
        {lines.map((line) => (
          <LedgerRow key={line.id} line={line} />
        ))}
      </div>
    </section>
  );
}

export function LabLedgerSummary({ model, className }: LabLedgerPanelProps) {
  if (!model) {
    return (
      <div className={cn("flex min-h-[120px] items-center justify-center", className)}>
        <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200/80" />
      </div>
    );
  }

  const headlines = pickHeadlineLines(model);

  return (
    <div className={className}>
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Votre calcul</p>
      <h2 className="mt-1 text-xl font-light tracking-tight text-slate-900 lg:text-2xl">{model.doorTitle}</h2>
      {model.verdict && (
        <VerdictDot
          verdict={model.verdict.verdict}
          label={model.verdict.headline}
          className="mt-2"
        />
      )}
      {headlines.length > 0 && (
        <div
          className={cn(
            "mt-3 grid gap-2",
            headlines.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
          )}
        >
          {headlines.map((line) => (
            <HeadlineChip key={line.id} line={line} />
          ))}
        </div>
      )}
      <p className="mt-3 hidden text-[11px] text-slate-400 lg:block">
        Détail ci-dessous · leviers à droite
      </p>
    </div>
  );
}

export function LabLedgerDetails({ model, className }: LabLedgerPanelProps) {
  const reduced = useReducedMotion();
  const pulseKey = ledgerFingerprint(model);

  if (!model) return null;

  const groups = groupLedgerLines(linesForLedgerDetail(model));

  return (
    <div className={className}>
      <p className="mb-3.5 text-xs font-medium uppercase tracking-wider text-slate-500">Détail du calcul</p>

      <motion.div
        key={pulseKey}
        initial={reduced ? false : { backgroundColor: "rgba(0,111,199,0.05)" }}
        animate={{ backgroundColor: "rgba(0,111,199,0)" }}
        transition={{ duration: 0.65 }}
        className="space-y-3 rounded-xl"
      >
        {groups.map((group) => (
          <LedgerSectionBlock
            key={group.sectionId}
            sectionId={group.sectionId}
            lines={group.lines}
            doorId={model.doorId}
          />
        ))}
      </motion.div>

      {(model.footer || model.contextNote) && <LedgerFooterInsights ledger={model} />}
    </div>
  );
}

/** Vue combinée (legacy / tests visuels). */
export function LabLedger({ model, className }: LabLedgerPanelProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <LabLedgerSummary model={model} />
      <LabLedgerDetails model={model} className="mt-6" />
    </div>
  );
}
