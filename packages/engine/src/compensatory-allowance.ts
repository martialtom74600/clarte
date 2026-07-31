import type { Money, PersonId, SimulationInput } from "@separation/schemas";
import { eur, round } from "./utils.js";

export interface CompensatoryAllowanceEstimate {
  applicable: boolean;
  payer: PersonId;
  receiver: PersonId;
  /** Capital indicatif (art. 270–271 — méthode forfaitaire). */
  capitalEstimate: Money;
  marriageYears: number | null;
  incomeGapAnnual: Money;
  method: string;
  note: string;
}

function marriageYearsFrom(input: SimulationInput, asOf = new Date()): number | null {
  if (!input.marriageDate) return null;
  const start = new Date(input.marriageDate);
  if (Number.isNaN(start.getTime())) return null;
  const years = (asOf.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.max(0, round(years, 1));
}

/**
 * Estimation indicative de prestation compensatoire (art. 270–271 C. civ.).
 * Méthode forfaitaire courante en pratique amiable :
 * (1/3) × |écart revenus annuels| × (durée mariage / 2), plafonnée par l'écart patrimonial.
 */
export function estimateCompensatoryAllowance(
  input: SimulationInput,
  netWorthA: number,
  netWorthB: number
): CompensatoryAllowanceEstimate | null {
  if (input.status !== "marriage") return null;

  const incomeA = input.persons.find((p) => p.id === "A")?.income?.amount ?? 0;
  const incomeB = input.persons.find((p) => p.id === "B")?.income?.amount ?? 0;
  const annualGap = Math.abs(incomeA - incomeB) * 12;
  const years = marriageYearsFrom(input) ?? 8; // défaut indicatif si date absente
  const yearsKnown = marriageYearsFrom(input);

  const richerIncome: PersonId = incomeA >= incomeB ? "A" : "B";
  const poorerIncome: PersonId = richerIncome === "A" ? "B" : "A";
  const richerNet: PersonId = netWorthA >= netWorthB ? "A" : "B";

  const patrimRatio =
    Math.min(netWorthA, netWorthB) > 0
      ? Math.max(netWorthA, netWorthB) / Math.min(netWorthA, netWorthB)
      : Math.max(netWorthA, netWorthB) > 0
        ? 99
        : 1;

  const incomeRatio =
    Math.min(incomeA, incomeB) > 0
      ? Math.max(incomeA, incomeB) / Math.min(incomeA, incomeB)
      : Math.max(incomeA, incomeB) > 0
        ? 99
        : 1;

  const disparity = patrimRatio >= 1.5 || incomeRatio >= 1.5 || annualGap >= 12_000;
  if (!disparity || years < 2) {
    return {
      applicable: false,
      payer: richerIncome,
      receiver: poorerIncome,
      capitalEstimate: eur(0),
      marriageYears: yearsKnown,
      incomeGapAnnual: eur(annualGap),
      method: "seuil non atteint",
      note: "Pas de prestation compensatoire indicative — écart de revenus / patrimoine insuffisant ou mariage court.",
    };
  }

  // Formule forfaitaire amiable (ordre de grandeur cabinets).
  let capital = (1 / 3) * annualGap * (years / 2);
  const patrimGapHalf = Math.abs(netWorthA - netWorthB) / 2;
  if (patrimGapHalf > 0) {
    capital = Math.min(capital, patrimGapHalf);
  }
  // Plancher / plafond indicatifs
  capital = Math.max(0, Math.min(capital, 250_000));
  capital = round(capital);

  // Débiteur = celui avec revenus (et souvent patrimoine) plus élevés
  const payer: PersonId =
    richerIncome === richerNet ? richerIncome : richerIncome;
  const receiver: PersonId = payer === "A" ? "B" : "A";

  return {
    applicable: capital > 0,
    payer,
    receiver,
    capitalEstimate: eur(capital),
    marriageYears: yearsKnown,
    incomeGapAnnual: eur(annualGap),
    method: "(1/3) × écart revenus annuels × (durée/2), plafonné par l'écart patrimonial / 2",
    note: `Prestation compensatoire indicative ~${Math.round(capital).toLocaleString("fr-FR")} € (${payer} → ${receiver}) — art. 270–271 C. civ. ; quantum amiable, seul le juge tranche.`,
  };
}
