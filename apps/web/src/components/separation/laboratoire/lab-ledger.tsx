"use client";

import { useReducedMotion } from "framer-motion";
import { motion } from "framer-motion";
import type { AffordabilityVerdict } from "@separation/schemas";
import { cn, formatEuro } from "@/lib/utils";
import type { LabLedgerModel, LedgerLine } from "@/lib/separation/lab-ledger-model";
import { ledgerFingerprint } from "@/lib/separation/lab-ledger-model";
import {
  groupLedgerLines,
  LEDGER_SECTION_META,
  type LedgerSectionId,
} from "@/lib/separation/lab-ledger-sections";
import { VerdictDot } from "@/components/separation/portes/verdict-dot";

interface LabLedgerPanelProps {
  model: LabLedgerModel | null;
  className?: string;
}

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

function pickHeadlineLines(model: LabLedgerModel): LedgerLine[] {
  const byDoor: Record<LabLedgerModel["doorId"], string[]> = {
    keep_a: ["total-cash", "monthly", "soulte"],
    keep_b: ["total-cash", "monthly", "soulte"],
    sell: ["you", "net"],
    rent_out: ["net", "effective-rent"],
  };

  return byDoor[model.doorId]
    .map((id) => model.lines.find((line) => line.id === id))
    .filter((line): line is LedgerLine => line != null);
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
        amount: "text-base font-medium text-slate-900",
        row: "rounded-lg bg-white/90 px-2 py-2 ring-1 ring-slate-200/90",
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
        "flex items-start justify-between gap-3 px-1.5 py-1.5 -mx-1.5 transition-colors",
        styles.row
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {!compact && (
          <span
            className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ring-1",
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
              line.tone === "total" ? "font-medium text-slate-900" : "text-slate-700"
            )}
          >
            {line.label}
          </p>
          {!compact && line.hint && (
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{line.hint}</p>
          )}
        </div>
      </div>
      <span className={cn("shrink-0 tabular-nums text-sm", styles.amount)}>
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
    <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-slate-200/80">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{line.label}</p>
      <p className="mt-0.5 tabular-nums text-base font-semibold text-slate-900">
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
}: {
  sectionId: LedgerSectionId;
  lines: LedgerLine[];
}) {
  const meta = LEDGER_SECTION_META[sectionId];

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-slate-200/70 border-l-4",
        meta.border,
        meta.bg
      )}
    >
      <header className="border-b border-slate-200/40 px-3 py-2">
        <h3 className={cn("text-xs font-semibold tracking-tight", meta.titleColor)}>{meta.title}</h3>
      </header>
      <div className="px-1.5 py-1">
        {lines.map((line) => (
          <LedgerRow key={line.id} line={line} />
        ))}
      </div>
    </section>
  );
}

function parseFooterBlocks(footer: string) {
  const lines = footer.split("\n").map((l) => l.trim()).filter(Boolean);
  const debtLine = lines.find((l) => /endettement sera de \d+ %/i.test(l));
  const debtMatch = debtLine?.match(/endettement sera de (\d+) %/i);
  const relocateLine = lines.find(
    (l) => l.startsWith("Partant :") || l.startsWith("Relogement dans le quartier")
  );
  const negativeEquityLine = lines.find(
    (l) =>
      l.includes("Actif net négatif") ||
      l.includes("dette à partager") ||
      l.includes("Dette résiduelle")
  );
  const otherLines = lines.filter(
    (l) =>
      l !== debtLine &&
      l !== relocateLine &&
      l !== negativeEquityLine &&
      !l.includes("désolidarisation") &&
      !l.startsWith("Produit net partagé") &&
      !l.startsWith("Cible relogement")
  );

  return { debtLine, debtPct: debtMatch ? Number(debtMatch[1]) : null, relocateLine, negativeEquityLine, otherLines };
}

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

function LedgerFooterInsights({
  footer,
  verdict,
  contextNote,
}: {
  footer: string;
  verdict: LabLedgerModel["verdict"];
  contextNote?: string;
}) {
  const { debtLine, debtPct, relocateLine, negativeEquityLine, otherLines } = parseFooterBlocks(footer);
  const panel = verdict ? VERDICT_PANEL[verdict.verdict] : null;

  return (
    <details className="group mt-4 rounded-xl border border-slate-200/80 bg-white/50">
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
                <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                  Calcul : mensualités totales ÷ revenus nets mensuels (plafond HCSF {35} %).
                </p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", panel.border, panel.bg, panel.text)}>
                {panel.label}
              </span>
            </div>
          </div>
        )}

        {relocateLine && (
          <div className="rounded-lg border border-slate-200 bg-white/70 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Relogement</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-700">{relocateLine}</p>
          </div>
        )}

        {otherLines.map((line, index) => (
          <p key={`insight-${index}-${line.slice(0, 24)}`} className="text-xs leading-relaxed text-slate-500">
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
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Votre calcul</p>
      <h2 className="mt-1 text-xl font-light tracking-tight text-slate-900">{model.doorTitle}</h2>
      {model.verdict && (
        <VerdictDot
          verdict={model.verdict.verdict}
          label={model.verdict.headline}
          className="mt-2"
        />
      )}
      {headlines.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {headlines.map((line) => (
            <HeadlineChip key={line.id} line={line} />
          ))}
        </div>
      )}
      <p className="mt-3 hidden text-[11px] text-slate-400 lg:block">
        Défilez ci-dessous pour le détail · les leviers restent visibles à droite
      </p>
    </div>
  );
}

export function LabLedgerDetails({ model, className }: LabLedgerPanelProps) {
  const reduced = useReducedMotion();
  const pulseKey = ledgerFingerprint(model);

  if (!model) return null;

  const groups = groupLedgerLines(model.lines);

  return (
    <div className={className}>
      <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">Détail</p>

      <motion.div
        key={pulseKey}
        initial={reduced ? false : { backgroundColor: "rgba(0,111,199,0.05)" }}
        animate={{ backgroundColor: "rgba(0,111,199,0)" }}
        transition={{ duration: 0.65 }}
        className="space-y-2.5 rounded-xl"
      >
        {groups.map((group) => (
          <LedgerSectionBlock key={group.sectionId} sectionId={group.sectionId} lines={group.lines} />
        ))}
      </motion.div>

      {model.footer && (
        <LedgerFooterInsights
          footer={model.footer}
          verdict={model.verdict}
          contextNote={model.contextNote}
        />
      )}

      {model.warningNote && (
        <p
          className="mt-3 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-950"
          role="note"
        >
          <span className="font-medium">Banque : </span>
          {model.warningNote}
        </p>
      )}
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
