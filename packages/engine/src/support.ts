import type { Money, PersonId } from "@separation/schemas";
import { eur, round } from "./utils.js";

export type CustodyType = "classic" | "alternate" | "reduced";

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
  availableIncome: number;
}

/**
 * Minimum vital déduit du revenu du débiteur.
 * Table de référence ministère de la Justice (RSA personne seule) — figée pack 2026.
 */
export const CEEE_MINIMUM_VITAL = 652;

/** Référence documentaire de la grille CEEE utilisée. */
export const CEEE_TABLE_AS_OF = "2024-04 (figée pack Clarté 2026)";

/**
 * Taux officiels dégressifs (table de référence ministère de la Justice).
 * Appliqués à (revenu net − 652 €), pas au revenu brut.
 */
export const SUPPORT_RATES: Record<CustodyType, Record<number, number>> = {
  classic: { 1: 0.135, 2: 0.115, 3: 0.1, 4: 0.088, 5: 0.08, 6: 0.072 },
  alternate: { 1: 0.09, 2: 0.078, 3: 0.067, 4: 0.059, 5: 0.053, 6: 0.047 },
  reduced: { 1: 0.18, 2: 0.155, 3: 0.133, 4: 0.117, 5: 0.106, 6: 0.095 },
};

const CUSTODY_LABEL: Record<CustodyType, string> = {
  classic: "garde classique",
  alternate: "garde alternée",
  reduced: "droit de visite réduit",
};

export function estimateChildSupport(input: ChildSupportInput): ChildSupportResult | null {
  if (input.numberOfChildren <= 0 || input.payerIncomeMonthly <= 0) return null;

  const childCount = Math.min(Math.max(1, input.numberOfChildren), 6);
  const rate =
    SUPPORT_RATES[input.custodyType][childCount] ??
    SUPPORT_RATES[input.custodyType][6];

  const payerId: PersonId =
    input.payerId ??
    (input.payerIncomeMonthly >= input.recipientIncomeMonthly ? "A" : "B");

  const availableIncome = Math.max(0, input.payerIncomeMonthly - CEEE_MINIMUM_VITAL);
  const monthlyAmount = round(availableIncome * rate);

  return {
    monthlyAmount: eur(monthlyAmount),
    payerId,
    percentageApplied: rate * 100,
    availableIncome,
    basis: `Barème Justice ${(rate * 100).toFixed(1).replace(".", ",")} % × (revenu − ${CEEE_MINIMUM_VITAL} €), ${CUSTODY_LABEL[input.custodyType]}, ${childCount} enfant(s)`,
    disclaimer:
      "Montant indicatif basé sur la table de référence du Ministère de la Justice. Seul un juge ou un accord amiable fait foi.",
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
