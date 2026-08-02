import type {
  AffordabilityVerdict,
  Money,
  PersonId,
  RelocateMarketTier,
  SimulationInput,
  SoulteResult,
} from "@separation/schemas";
import { computeAffordability } from "./affordability.js";
import { rentPerSqm } from "./market-rents.js";
import { getMortgageRateSnapshot } from "./mortgage-rates.js";
import { resolveRelocateHousing } from "./relocate-housing.js";
import { eur, round } from "./utils.js";

export interface KeepBilateralExtras {
  departurePersonId: PersonId;
  departureCapital: Money;
  /** Soulte + indemnité d'occupation. */
  buyoutTransferTotal: Money;
  occupationMonths: number;
  occupationMonthlyHalfRent: Money;
  occupationIndemnity: Money;
  relocateTarget: Money;
  relocateSurfaceSqm: number;
  relocateMarketTier: RelocateMarketTier;
  relocateHousingNote: string;
  relocateVerdictByPerson: Record<PersonId, AffordabilityVerdict>;
  departureRelocateVerdict: AffordabilityVerdict;
  occupationNote?: string;
}

function incomeFor(input: SimulationInput, person: PersonId): number {
  return input.persons.find((p) => p.id === person)?.income?.amount ?? 0;
}

/** Indemnité d'occupation : (loyer estimé / 2) × mois d'occupation exclusive. */
export function computeOccupationIndemnity(
  grossRentMonthly: number,
  months: number
): number {
  if (months <= 0 || grossRentMonthly <= 0) return 0;
  return round((grossRentMonthly / 2) * months);
}

export function estimateGrossRentMonthly(input: SimulationInput): number {
  if (input.options.monthlyRentOverride && input.options.monthlyRentOverride > 0) {
    return round(input.options.monthlyRentOverride);
  }
  const postalCode = input.postalCode ?? "75000";
  const surface = input.propertySurface ?? 65;
  return round(rentPerSqm(postalCode) * surface);
}

/**
 * Enrichit un scénario keep_* : capital du partant, relogement zone,
 * indemnité d'occupation éventuelle (levier labo).
 */
export function computeKeepBilateralExtras(
  input: SimulationInput,
  keeper: PersonId,
  soulte: SoulteResult
): KeepBilateralExtras {
  const departurePersonId: PersonId = keeper === "A" ? "B" : "A";
  const months = Math.max(0, Math.floor(input.options.occupationMonths ?? 0));
  const grossRent = estimateGrossRentMonthly(input);
  const monthlyHalf = eur(round(grossRent / 2));
  const indemnityAmt = computeOccupationIndemnity(grossRent, months);
  const indemnity = eur(indemnityAmt);

  const soulteAmt = Math.max(0, soulte.amount.amount);
  const departureCapital = eur(soulteAmt + indemnityAmt);
  const buyoutTransferTotal = eur(soulteAmt + indemnityAmt);

  const housing = resolveRelocateHousing(input);
  const relocateTarget = housing.targetPrice;
  const rateSnapshot = getMortgageRateSnapshot(input.options.mortgageDurationYears ?? 20);

  const departureAff = computeAffordability({
    incomeMonthly: incomeFor(input, departurePersonId),
    liquidCapital: Math.max(0, departureCapital.amount),
    targetPropertyPrice: relocateTarget.amount,
    durationYears: rateSnapshot.durationYears,
  });

  // Le racheteur garde le bien — pas de test de relogement pour lui.
  const keeperRelocate: AffordabilityVerdict = "green";

  const relocateVerdictByPerson: Record<PersonId, AffordabilityVerdict> = {
    A: keeper === "A" ? keeperRelocate : departureAff.verdict,
    B: keeper === "B" ? keeperRelocate : departureAff.verdict,
  };

  const occupationNote =
    months > 0
      ? `Indemnité d'occupation : ${Math.round(grossRent).toLocaleString("fr-FR")} €/mois ÷ 2 × ${months} mois = ${Math.round(indemnityAmt).toLocaleString("fr-FR")} € (imputée sur le rachat).`
      : undefined;

  return {
    departurePersonId,
    departureCapital,
    buyoutTransferTotal,
    occupationMonths: months,
    occupationMonthlyHalfRent: monthlyHalf,
    occupationIndemnity: indemnity,
    relocateTarget,
    relocateSurfaceSqm: housing.surfaceSqm,
    relocateMarketTier: housing.tier,
    relocateHousingNote: housing.note,
    relocateVerdictByPerson,
    departureRelocateVerdict: departureAff.verdict,
    occupationNote,
  };
}
