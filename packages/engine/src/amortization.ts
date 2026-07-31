import { round } from "./utils.js";
import { DEFAULT_MORTGAGE_INSURANCE_ANNUAL_RATE } from "./constants.js";

export { DEFAULT_MORTGAGE_INSURANCE_ANNUAL_RATE } from "./constants.js";

export interface AmortizationInput {
  /** Capital emprunté initial (€). */
  principal: number;
  /** Taux d'intérêt annuel hors assurance (décimal, ex. 0.012 pour 1,2 %). */
  annualRate: number;
  /** Durée initiale du prêt (années). */
  durationYears: number;
  /** Mois de souscription (1–12). */
  startMonth: number;
  /** Année de souscription (ex. 2021). */
  startYear: number;
  /** Date de référence pour le CRD (défaut : aujourd'hui). */
  asOfDate?: Date;
  /**
   * Taux d'assurance annuel sur capital initial (décimal, ex. 0.0034 pour 0,34 %).
   * Ignoré si `monthlyInsuranceEuro` > 0.
   */
  insuranceAnnualRate?: number;
  /** Coût mensuel d'assurance fixe (€) — prime sur le taux estimé. */
  monthlyInsuranceEuro?: number;
}

export interface AmortizationResult {
  /** Mensualité hors assurance (capital + intérêts). */
  monthlyPaymentPrincipalInterest: number;
  /** Part assurance mensuelle. */
  monthlyInsurance: number;
  /** Mensualité totale (HCSF : capital + intérêts + assurance). */
  monthlyPaymentTotal: number;
  /** Capital restant dû à la date de référence. */
  remainingBalance: number;
  /** Mois restants avant extinction du prêt. */
  remainingMonths: number;
  /** Durée restante arrondie au supérieur (années, pour affichage). */
  remainingYears: number;
  /** Mois écoulés depuis la souscription. */
  elapsedMonths: number;
  /** Durée totale du prêt en mois. */
  totalMonths: number;
}

function monthsBetween(startYear: number, startMonth: number, end: Date): number {
  const endYear = end.getFullYear();
  const endMonth = end.getMonth() + 1;
  return Math.max(0, (endYear - startYear) * 12 + (endMonth - startMonth));
}

/** Mensualité constante (capital + intérêts) — formule standard. */
export function monthlyPaymentFromPrincipal(
  principal: number,
  annualRate: number,
  durationYears: number
): number {
  if (principal <= 0 || durationYears <= 0) return 0;
  const months = durationYears * 12;
  const monthlyRate = annualRate / 12;
  if (monthlyRate === 0) return principal / months;
  return (
    (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months))
  );
}

/** CRD après p mois d'amortissement à mensualité constante. */
export function remainingBalanceAfterMonths(
  principal: number,
  annualRate: number,
  durationYears: number,
  elapsedMonths: number
): number {
  if (principal <= 0 || durationYears <= 0) return 0;
  const totalMonths = durationYears * 12;
  const p = Math.max(0, Math.min(elapsedMonths, totalMonths));
  if (p >= totalMonths) return 0;

  const monthlyRate = annualRate / 12;
  if (monthlyRate === 0) {
    return principal * (1 - p / totalMonths);
  }

  const factorN = Math.pow(1 + monthlyRate, totalMonths);
  const factorP = Math.pow(1 + monthlyRate, p);
  return (principal * (factorN - factorP)) / (factorN - 1);
}

function resolveMonthlyInsurance(
  principal: number,
  insuranceAnnualRate: number,
  monthlyInsuranceEuro?: number
): number {
  if (monthlyInsuranceEuro != null && monthlyInsuranceEuro > 0) {
    return monthlyInsuranceEuro;
  }
  if (principal <= 0) return 0;
  return (principal * insuranceAnnualRate) / 12;
}

/**
 * Calcule CRD, mensualité et durée restante à partir des paramètres de souscription.
 * La mensualité totale inclut l'assurance (charge HCSF).
 */
export function calculateAmortization(input: AmortizationInput): AmortizationResult {
  const {
    principal,
    annualRate,
    durationYears,
    startMonth,
    startYear,
    asOfDate = new Date(),
    insuranceAnnualRate = DEFAULT_MORTGAGE_INSURANCE_ANNUAL_RATE,
    monthlyInsuranceEuro,
  } = input;

  const totalMonths = Math.max(0, Math.round(durationYears * 12));
  const elapsedMonths = monthsBetween(startYear, startMonth, asOfDate);
  const remainingMonths = Math.max(0, totalMonths - elapsedMonths);

  const monthlyPaymentPrincipalInterest = round(
    monthlyPaymentFromPrincipal(principal, annualRate, durationYears)
  );
  const remainingBalance = round(
    remainingBalanceAfterMonths(principal, annualRate, durationYears, elapsedMonths)
  );
  const monthlyInsurance = round(
    resolveMonthlyInsurance(principal, insuranceAnnualRate, monthlyInsuranceEuro)
  );
  const monthlyPaymentTotal = round(monthlyPaymentPrincipalInterest + monthlyInsurance);

  const remainingYears =
    remainingMonths <= 0
      ? 0
      : Math.max(1, Math.min(30, Math.ceil(remainingMonths / 12)));

  return {
    monthlyPaymentPrincipalInterest,
    monthlyInsurance,
    monthlyPaymentTotal,
    remainingBalance,
    remainingMonths,
    remainingYears,
    elapsedMonths,
    totalMonths,
  };
}
