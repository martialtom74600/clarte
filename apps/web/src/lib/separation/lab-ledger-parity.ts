import type { DoorId } from "@separation/schemas";
import {
  buildZoneMarketSnapshot,
  computeAffordability,
  getMortgageRateSnapshot,
} from "@separation/engine";
import type { FootprintState } from "./separation-types";
import type { LabLedgerModel, LedgerLine } from "./lab-ledger-model";

/** Chips résumé en tête de ledger — même nombre de clés par porte. */
export const LEDGER_HEADLINE_IDS: Record<DoorId, readonly string[]> = {
  keep_a: ["total-cash", "monthly", "soulte"],
  keep_b: ["soulte", "departure-capital", "monthly"],
  sell: ["you", "net", "relocate-target"],
  rent_out: ["net", "monthly-balance", "relocate-target"],
};

/** Sections attendues par porte (hors enfants optionnel). */
export const LEDGER_REQUIRED_SECTIONS: Record<DoorId, readonly string[]> = {
  keep_a: ["bien", "echange", "relogement", "mensuel"],
  keep_b: ["bien", "echange", "relogement", "mensuel"],
  sell: ["bien", "echange", "relogement", "mensuel"],
  rent_out: ["bien", "revenus", "charges", "resultat", "relogement", "mensuel"],
};

export function pickHeadlineLines(model: LabLedgerModel): LedgerLine[] {
  return LEDGER_HEADLINE_IDS[model.doorId]
    .map((id) => model.lines.find((line) => line.id === id))
    .filter((line): line is LedgerLine => line != null);
}

export function estimateRelocateTarget(footprint: FootprintState): number {
  const surface = footprint.propertySurface > 0 ? footprint.propertySurface : 65;
  const postal = footprint.postalCode.replace(/\D/g, "").padStart(5, "0").slice(0, 5) || "75000";
  const zone = buildZoneMarketSnapshot(postal, surface);
  return Math.round(zone.minPricePerSqm.amount * Math.max(45, surface - 15));
}

export function estimateRelocateMonthlyPayment(params: {
  incomeMonthly: number;
  liquidCapital: number;
  targetPrice: number;
  mortgageYears?: number;
}): number {
  if (params.incomeMonthly <= 0 || params.targetPrice <= 0) return 0;
  const rate = getMortgageRateSnapshot(params.mortgageYears ?? 20);
  const aff = computeAffordability({
    incomeMonthly: params.incomeMonthly,
    liquidCapital: Math.max(0, params.liquidCapital),
    targetPropertyPrice: params.targetPrice,
    durationYears: rate.durationYears,
  });
  return Math.round(aff.monthlyPayment.amount);
}

export function relocateMonthlyLine(params: {
  id: string;
  label: string;
  incomeMonthly: number;
  liquidCapital: number;
  targetPrice: number;
  sectionId: LedgerLine["sectionId"];
  mortgageYears?: number;
}): LedgerLine | null {
  const amount = estimateRelocateMonthlyPayment(params);
  if (amount <= 0) return null;
  return {
    id: params.id,
    label: params.label,
    amount,
    tone: "neutral",
    suffix: "/mois",
    sectionId: params.sectionId,
    hint: "Simulation de prêt pour un logement équivalent dans le quartier",
  };
}

export function auditLedgerParity(ledger: LabLedgerModel): string[] {
  const issues: string[] = [];

  if (!ledger.footer) issues.push("footer manquant");
  if (!ledger.contextNote && !ledger.warningNote && !ledger.footer?.includes("endettement")) {
    issues.push("contextNote ou signal financier manquant");
  }

  if (ledger.lines.some((line) => !line.sectionId)) issues.push("sectionId manquant sur une ligne");
  if (ledger.lines.some((line) => !line.hint)) issues.push("hint manquant sur une ligne");

  const headlines = pickHeadlineLines(ledger);
  if (headlines.length < 3) issues.push(`headlines incomplets (${headlines.length}/3)`);

  const sections = new Set(ledger.lines.map((line) => line.sectionId));
  for (const required of LEDGER_REQUIRED_SECTIONS[ledger.doorId]) {
    if (!sections.has(required as LedgerLine["sectionId"])) {
      issues.push(`section ${required} absente`);
    }
  }

  return issues;
}
