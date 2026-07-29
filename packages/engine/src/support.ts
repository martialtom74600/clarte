import type { Money, PersonId } from "@separation/schemas";
import { eur, round } from "./utils.js";

export type CustodyType = "classic" | "alternate";

export interface ChildSupportInput {
  payerIncomeMonthly: number;
  recipientIncomeMonthly: number;
  numberOfChildren: number;
  custodyType: CustodyType;
  payerId?: PersonId;
}

export interface ChildSupportResult {
  monthlyAmount: Money;
  payerId: PersonId;
  basis: string;
  disclaimer: string;
  percentageApplied: number;
}

/**
 * Barème indicatif simplifié inspiré de la grille du Ministère de la Justice.
 * Les montants réels peuvent varier selon le juge et la situation concrète.
 */
const SUPPORT_RATES: Record<CustodyType, Record<number, number>> = {
  classic: { 1: 0.135, 2: 0.23, 3: 0.28, 4: 0.32 },
  alternate: { 1: 0.085, 2: 0.145, 3: 0.18, 4: 0.21 },
};

export function estimateChildSupport(input: ChildSupportInput): ChildSupportResult | null {
  if (input.numberOfChildren <= 0 || input.payerIncomeMonthly <= 0) return null;

  const childCount = Math.min(input.numberOfChildren, 4);
  const rate =
    SUPPORT_RATES[input.custodyType][childCount] ??
    SUPPORT_RATES[input.custodyType][4];

  const payerId: PersonId =
    input.payerId ??
    (input.payerIncomeMonthly >= input.recipientIncomeMonthly ? "A" : "B");

  const monthlyAmount = round(input.payerIncomeMonthly * rate);

  return {
    monthlyAmount: eur(monthlyAmount),
    payerId,
    percentageApplied: rate * 100,
    basis: `Barème indicatif ${input.custodyType === "classic" ? "garde classique" : "garde alternée"}, ${childCount} enfant(s)`,
    disclaimer:
      "Montant indicatif basé sur la grille du Ministère de la Justice. Seul un juge ou un accord amiable fait foi.",
  };
}

export interface PatrimonyImbalance {
  ratio: number;
  disadvantaged: PersonId;
  gapAmount: Money;
  suggestsCompensatoryAllowance: boolean;
  message: string;
}

export function analyzePatrimonyImbalance(
  netA: number,
  netB: number
): PatrimonyImbalance | null {
  const total = netA + netB;
  if (total <= 0) return null;

  const shareA = netA / total;
  const shareB = netB / total;
  const ratio = Math.max(shareA, shareB) / Math.min(shareA, shareB);

  if (ratio < 1.4) return null;

  const disadvantaged: PersonId = netA < netB ? "A" : "B";
  const gap = Math.abs(netA - netB) / 2;

  return {
    ratio: round(ratio, 1),
    disadvantaged,
    gapAmount: eur(gap),
    suggestsCompensatoryAllowance: ratio >= 2,
    message:
      ratio >= 2
        ? `Déséquilibre significatif (${round(ratio, 1)}:1). Une prestation compensatoire pourrait être envisagée pour rééquilibrer les niveaux de vie.`
        : `Écart patrimonial notable. Les chiffres objectivent la discussion sans prendre parti.`,
  };
}

export interface ResolutionComparison {
  amiable: {
    label: string;
    estimatedCost: Money;
    estimatedMonths: number;
    description: string;
  };
  contentieux: {
    label: string;
    estimatedCost: Money;
    estimatedMonths: number;
    description: string;
  };
  savings: Money;
  savingsMonths: number;
}

export function compareResolutionPaths(complexityScore: number): ResolutionComparison {
  const amiableBase = complexityScore > 60 ? 3500 : 2200;
  const contentieuxBase = complexityScore > 60 ? 18000 : 12000;
  const amiableMonths = complexityScore > 60 ? 3 : 2;
  const contentieuxMonths = complexityScore > 60 ? 24 : 18;

  const amiableCost = eur(amiableBase);
  const contentieuxCost = eur(contentieuxBase);

  return {
    amiable: {
      label: "Règlement amiable (notaire / médiateur)",
      estimatedCost: amiableCost,
      estimatedMonths: amiableMonths,
      description: "Protocole signé, acte notarié ou convention de médiation.",
    },
    contentieux: {
      label: "Procédure judiciaire",
      estimatedCost: contentieuxCost,
      estimatedMonths: contentieuxMonths,
      description: "Honoraires d'avocat, expertises, délais moyens constatés.",
    },
    savings: eur(contentieuxCost.amount - amiableCost.amount),
    savingsMonths: contentieuxMonths - amiableMonths,
  };
}
