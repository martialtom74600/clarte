import type {
  Asset,
  Liability,
  Money,
  PersonId,
  RentOutBreakdown,
  SimulationInput,
} from "@separation/schemas";
import { rentPerSqm } from "./market-rents.js";
import { eur, estimateMonthlyPayment, getShareForPerson, round } from "./utils.js";

/** Provision vacance locative (milieu de fourchette 5–8 %). */
export const DEFAULT_VACANCY_RATE = 0.06;

/** Taxe foncière estimée : ~0,8 % / an de la valeur vénale (ordre de grandeur). */
export const DEFAULT_PROPERTY_TAX_RATE_ANNUAL = 0.008;

/** Assurance PNO — forfait annuel indicatif. */
export const DEFAULT_PNO_ANNUAL_EUR = 180;

/**
 * Frais de gestion déléguée (agence) — % du loyer effectif.
 * 0 = gestion directe.
 */
export const DEFAULT_MANAGEMENT_FEE_RATE = 0.07;

/** Abattement micro-foncier (CGI). */
export const MICRO_FONCIER_ALLOWANCE_RATE = 0.3;

/** Prélèvements sociaux sur revenus fonciers. */
export const FONCIER_SOCIAL_CONTRIBUTIONS_RATE = 0.172;

/** Taux marginal IR indicatif (tranche moyenne) si non fourni. */
export const DEFAULT_MARGINAL_INCOME_TAX_RATE = 0.3;

/** Seuil d'excédent net pour feu vert. */
export const RENT_GREEN_THRESHOLD = 200;

export interface RentOutCashflowParams {
  postalCode: string;
  surfaceSqm: number;
  propertyValue: number;
  mortgagePaymentMonthly: number;
  /** Override loyer brut mensuel (levier labo). */
  monthlyRentOverride?: number;
  vacancyRate?: number;
  propertyTaxAnnual?: number;
  pnoAnnual?: number;
  /** Si true (défaut), applique DEFAULT_MANAGEMENT_FEE_RATE. */
  managementDelegated?: boolean;
  managementFeeRate?: number;
  marginalIncomeTaxRate?: number;
}

export interface RentOutCashflowResult {
  breakdown: RentOutBreakdown;
  netCashflowByPerson: Record<PersonId, Money>;
  formulaDetail: string;
}

function resolveMortgagePayment(input: SimulationInput, liabilities: Liability[]): number {
  if (input.monthlyMortgagePayment && input.monthlyMortgagePayment > 0) {
    return input.monthlyMortgagePayment;
  }
  const mortgage = liabilities.find((l) => l.type === "mortgage");
  if (!mortgage) return 0;
  return estimateMonthlyPayment(
    mortgage.remainingBalance.amount,
    input.options.mortgageRate ?? 0.0385,
    input.options.mortgageDurationYears ?? 20
  ).amount;
}

function resolveMarginalRate(input: SimulationInput): number {
  if (input.options.marginalIncomeTaxRate != null) {
    return input.options.marginalIncomeTaxRate;
  }
  const incomes = input.persons.map((p) => p.income?.amount ?? 0);
  const maxIncome = Math.max(...incomes, 0);
  // Barème IR simplifié 2026 (tranches annuelles approximatives → taux marginal).
  const annual = maxIncome * 12;
  if (annual <= 11_888) return 0;
  if (annual <= 30_191) return 0.11;
  if (annual <= 86_547) return 0.3;
  if (annual <= 185_259) return 0.41;
  return 0.45;
}

/**
 * Cashflow locatif réaliste 2026 :
 * Loyer effectif − crédit − TF − vacance − PNO − gestion − impôt micro-foncier.
 */
export function computeRentOutCashflowFromParams(
  params: RentOutCashflowParams,
  shares: { A: number; B: number } = { A: 0.5, B: 0.5 }
): RentOutCashflowResult {
  const vacancyRate = params.vacancyRate ?? DEFAULT_VACANCY_RATE;
  const managementDelegated = params.managementDelegated !== false;
  const managementFeeRate = managementDelegated
    ? (params.managementFeeRate ?? DEFAULT_MANAGEMENT_FEE_RATE)
    : (params.managementFeeRate ?? 0);
  const marginalIr =
    params.marginalIncomeTaxRate ?? DEFAULT_MARGINAL_INCOME_TAX_RATE;

  const grossRent =
    params.monthlyRentOverride && params.monthlyRentOverride > 0
      ? round(params.monthlyRentOverride)
      : round(rentPerSqm(params.postalCode) * params.surfaceSqm);

  const vacancyProvision = eur(round(grossRent * vacancyRate));
  const effectiveRent = eur(round(grossRent - vacancyProvision.amount));

  const propertyTaxAnnual =
    params.propertyTaxAnnual ??
    round(params.propertyValue * DEFAULT_PROPERTY_TAX_RATE_ANNUAL);
  const propertyTaxMonthly = eur(round(propertyTaxAnnual / 12));

  const pnoAnnual = params.pnoAnnual ?? DEFAULT_PNO_ANNUAL_EUR;
  const pnoMonthly = eur(round(pnoAnnual / 12));

  const managementFees = eur(round(effectiveRent.amount * managementFeeRate));
  const mortgagePayment = eur(round(params.mortgagePaymentMonthly));

  const taxableBaseMonthly = eur(
    round(effectiveRent.amount * (1 - MICRO_FONCIER_ALLOWANCE_RATE))
  );
  const taxRateCombined = marginalIr + FONCIER_SOCIAL_CONTRIBUTIONS_RATE;
  const incomeTaxEstimate = eur(round(taxableBaseMonthly.amount * taxRateCombined));

  const structuralCharges = eur(
    round(
      mortgagePayment.amount +
        propertyTaxMonthly.amount +
        pnoMonthly.amount +
        managementFees.amount
    )
  );

  const netCashflow = eur(
    round(effectiveRent.amount - structuralCharges.amount - incomeTaxEstimate.amount)
  );

  const breakdown: RentOutBreakdown = {
    grossRent: eur(grossRent),
    vacancyRate,
    vacancyProvision,
    effectiveRent,
    mortgagePayment,
    propertyTaxMonthly,
    pnoMonthly,
    managementFeeRate,
    managementFees,
    microFoncierAllowanceRate: MICRO_FONCIER_ALLOWANCE_RATE,
    taxableBaseMonthly,
    marginalIncomeTaxRate: marginalIr,
    socialContributionsRate: FONCIER_SOCIAL_CONTRIBUTIONS_RATE,
    incomeTaxEstimate,
    structuralCharges,
    netCashflow,
  };

  const formulaDetail =
    `Loyer ${Math.round(grossRent).toLocaleString("fr-FR")} €` +
    ` − vacance ${Math.round(vacancyProvision.amount).toLocaleString("fr-FR")} €` +
    ` − crédit ${Math.round(mortgagePayment.amount).toLocaleString("fr-FR")} €` +
    ` − TF ${Math.round(propertyTaxMonthly.amount).toLocaleString("fr-FR")} €` +
    ` − PNO ${Math.round(pnoMonthly.amount).toLocaleString("fr-FR")} €` +
    ` − gestion ${Math.round(managementFees.amount).toLocaleString("fr-FR")} €` +
    ` − impôts micro-foncier ${Math.round(incomeTaxEstimate.amount).toLocaleString("fr-FR")} €` +
    ` = ${Math.round(netCashflow.amount).toLocaleString("fr-FR")} €/mois`;

  return {
    breakdown,
    netCashflowByPerson: {
      A: eur(netCashflow.amount * shares.A),
      B: eur(netCashflow.amount * shares.B),
    },
    formulaDetail,
  };
}

export function computeRentOutCashflow(
  asset: Asset,
  liabilities: Liability[],
  input: SimulationInput
): RentOutCashflowResult {
  const postalCode = input.postalCode ?? "75000";
  const surfaceSqm = input.propertySurface ?? 65;
  const shareA = getShareForPerson(asset.ownership, "A");
  const shareB = getShareForPerson(asset.ownership, "B");

  return computeRentOutCashflowFromParams(
    {
      postalCode,
      surfaceSqm,
      propertyValue: asset.grossValue.amount,
      mortgagePaymentMonthly: resolveMortgagePayment(input, liabilities),
      monthlyRentOverride: input.options.monthlyRentOverride,
      vacancyRate: input.options.vacancyRate,
      propertyTaxAnnual: input.options.propertyTaxAnnual,
      pnoAnnual: input.options.pnoAnnual,
      managementDelegated: input.options.managementDelegated,
      managementFeeRate: input.options.managementFeeRate,
      marginalIncomeTaxRate: resolveMarginalRate(input),
    },
    { A: shareA, B: shareB }
  );
}
