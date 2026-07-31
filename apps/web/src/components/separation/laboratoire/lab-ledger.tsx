"use client";

import { useReducedMotion } from "framer-motion";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import type { AffordabilityVerdict } from "@separation/schemas";
import { clarte } from "@/lib/clarte-design";
import { cn, formatEuro } from "@/lib/utils";
import type { LabLedgerModel } from "@/lib/separation/lab-ledger-model";
import { ledgerFingerprint } from "@/lib/separation/lab-ledger-model";
import {
  groupLedgerLines,
  LEDGER_SECTION_META,
  type LedgerSectionId,
} from "@/lib/separation/lab-ledger-sections";
import { VerdictDot } from "@/components/separation/portes/verdict-dot";

interface LabLedgerProps {
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

function toneStyles(tone: LabLedgerModel["lines"][number]["tone"]) {
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
        row: "bg-brand-50/35 hover:bg-brand-50/55",
      };
    case "total":
      return {
        badge: "∑",
        badgeClass: "bg-slate-900 text-white ring-slate-700/80",
        amount: "text-lg font-medium text-slate-900",
        row: "rounded-lg bg-white/90 px-3 py-2.5 shadow-sm ring-1 ring-slate-200/90",
      };
    default:
      return {
        badge: "+",
        badgeClass: "bg-emerald-100 text-emerald-800 ring-emerald-200/80",
        amount: "text-slate-800",
        row: "hover:bg-slate-50/70",
      };
  }
}

function LedgerRow({ line }: { line: LabLedgerModel["lines"][number] }) {
  const styles = toneStyles(line.tone);
  const prefix = line.tone === "subtract" ? "−" : "";

  return (
    <div className={cn("flex items-start justify-between gap-3 px-2 py-2.5 -mx-2 transition-colors", styles.row)}>
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ring-1",
            styles.badgeClass
          )}
          aria-hidden
        >
          {styles.badge}
        </span>
        <div className="min-w-0 text-left">
          <p
            className={cn(
              "text-sm leading-snug",
              line.tone === "total" ? "font-medium text-slate-900" : "text-slate-700"
            )}
          >
            {line.label}
          </p>
          {line.hint && (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{line.hint}</p>
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

function LedgerSectionBlock({
  sectionId,
  lines,
}: {
  sectionId: LedgerSectionId;
  lines: LabLedgerModel["lines"];
}) {
  const meta = LEDGER_SECTION_META[sectionId];

  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200/70 border-l-4 pl-0",
        meta.border,
        meta.bg
      )}
    >
      <header className="border-b border-slate-200/50 px-4 py-3">
        <h3 className={cn("text-sm font-semibold tracking-tight", meta.titleColor)}>{meta.title}</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{meta.subtitle}</p>
      </header>
      <div className="space-y-0.5 px-2 py-2">{lines.map((line) => <LedgerRow key={line.id} line={line} />)}</div>
    </section>
  );
}

function LedgerLegend() {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-white/60 px-3 py-2.5 text-xs text-slate-500 ring-1 ring-slate-200/70">
      <span className="inline-flex items-center gap-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-800">
          +
        </span>
        Entrée
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-100 text-[9px] font-bold text-rose-700">
          −
        </span>
        Sortie
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-800">
          =
        </span>
        Résultat intermédiaire
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-[9px] font-bold text-white">
          ∑
        </span>
        Total clé
      </span>
    </div>
  );
}

function parseFooterBlocks(footer: string) {
  const lines = footer.split("\n").map((l) => l.trim()).filter(Boolean);
  const debtLine = lines.find((l) => /endettement sera de \d+ %/i.test(l));
  const debtMatch = debtLine?.match(/endettement sera de (\d+) %/i);
  const relocateLine = lines.find((l) => l.startsWith("Partant :"));
  const negativeEquityLine = lines.find(
    (l) => l.includes("Actif net négatif") || l.includes("dette à partager")
  );
  const otherLines = lines.filter(
    (l) =>
      l !== debtLine &&
      l !== relocateLine &&
      l !== negativeEquityLine &&
      !l.includes("désolidarisation")
  );

  return { debtLine, debtPct: debtMatch ? Number(debtMatch[1]) : null, relocateLine, negativeEquityLine, otherLines };
}

function LedgerFooterInsights({
  footer,
  verdict,
}: {
  footer: string;
  verdict: LabLedgerModel["verdict"];
}) {
  const { debtLine, debtPct, relocateLine, negativeEquityLine, otherLines } = parseFooterBlocks(footer);
  const panel = verdict ? VERDICT_PANEL[verdict.verdict] : null;

  return (
    <div className="mt-8 space-y-3">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Ce que ça signifie</p>

      {negativeEquityLine && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-3">
          <p className="text-sm font-medium text-rose-950">{negativeEquityLine}</p>
          <p className="mt-1 text-xs text-rose-800/80">
            Le logement vaut moins que le crédit restant — la dette se partage entre vous.
          </p>
        </div>
      )}

      {debtLine && panel && (
        <div className={cn("rounded-xl border px-4 py-3.5", panel.border, panel.bg)}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Endettement bancaire
              </p>
              {debtPct != null && (
                <p className={cn("mt-1 text-2xl font-light tabular-nums", panel.text)}>
                  {debtPct} %
                </p>
              )}
              <p className={cn("mt-1 text-sm leading-relaxed", panel.text)}>{debtLine}</p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                panel.bg,
                panel.text,
                "ring-1",
                panel.border
              )}
            >
              {panel.label}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Les banques regardent surtout ce ratio : vos charges de prêt ÷ vos revenus (plafond
            habituel ~35 %).
          </p>
        </div>
      )}

      {relocateLine && (
        <div className="rounded-xl border border-slate-200 bg-white/70 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Relogement</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-700">{relocateLine}</p>
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

  const groups = groupLedgerLines(model.lines);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Votre calcul</p>
        <h2 className="mt-2 text-2xl font-light tracking-tight text-slate-900">{model.doorTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Ligne par ligne, sans jargon — vous voyez d&apos;où viennent les montants.
        </p>
        {model.verdict && (
          <VerdictDot
            verdict={model.verdict.verdict}
            label={model.verdict.headline}
            className="mt-4"
          />
        )}
      </div>

      <LedgerLegend />

      <motion.div
        key={pulseKey}
        initial={reduced ? false : { backgroundColor: "rgba(0,111,199,0.06)" }}
        animate={{ backgroundColor: "rgba(0,111,199,0)" }}
        transition={{ duration: 0.65 }}
        className="space-y-4 rounded-xl"
      >
        {groups.map((group) => (
          <LedgerSectionBlock key={group.sectionId} sectionId={group.sectionId} lines={group.lines} />
        ))}
      </motion.div>

      {model.footer && (
        <LedgerFooterInsights footer={model.footer} verdict={model.verdict} />
      )}

      {model.warningNote && (
        <p
          className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-xs leading-relaxed text-amber-950"
          role="note"
        >
          <span className="font-medium">Banque : </span>
          {model.warningNote}
        </p>
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
