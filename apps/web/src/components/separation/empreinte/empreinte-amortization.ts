import {
  calculateAmortization,
  DEFAULT_MORTGAGE_INSURANCE_ANNUAL_RATE,
} from "@separation/engine";
import { parseCurrency, parseNumber } from "@/components/separation/empreinte/empreinte-field";
import type { EmpreinteDraft } from "./empreinte-screens";

export function parseRatePercent(raw: string): number {
  const normalized = raw.replace(",", ".").replace(/[^\d.]/g, "");
  if (!normalized) return 0;
  const pct = Number(normalized);
  if (!Number.isFinite(pct) || pct < 0) return 0;
  return pct / 100;
}

export function formatRatePercent(decimal: number): string {
  if (decimal <= 0) return "";
  const pct = decimal * 100;
  return pct.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function isValidMonthYear(month: number, year: number): boolean {
  return month >= 1 && month <= 12 && year >= 1990 && year <= 2100;
}

function expandTwoDigitYear(year: number): number {
  if (year >= 100) return year;
  return year >= 70 ? 1900 + year : 2000 + year;
}

/** Valide et parse MM/AAAA (séparateurs / - . espace, compact 012021, MMYY). */
export function parseMortgageStartDate(raw: string): { month: number; year: number } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const sepMatch = trimmed.match(/^(\d{1,2})\s*[/.-\s]\s*(\d{2,4})$/);
  if (sepMatch) {
    const month = Number(sepMatch[1]);
    let year = Number(sepMatch[2]);
    if (year < 100) year = expandTwoDigitYear(year);
    if (isValidMonthYear(month, year)) return { month, year };
    return null;
  }

  const yearFirstMatch = trimmed.match(/^(\d{4})\s*[/.-\s]\s*(\d{1,2})$/);
  if (yearFirstMatch) {
    const year = Number(yearFirstMatch[1]);
    const month = Number(yearFirstMatch[2]);
    if (isValidMonthYear(month, year)) return { month, year };
    return null;
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 6) {
    const month = Number(digits.slice(0, 2));
    const year = Number(digits.slice(2));
    if (isValidMonthYear(month, year)) return { month, year };
  }
  if (digits.length === 4) {
    const month = Number(digits.slice(0, 2));
    const year = expandTwoDigitYear(Number(digits.slice(2)));
    if (isValidMonthYear(month, year)) return { month, year };
  }

  return null;
}

export function formatMortgageStartDate(month: number, year: number): string {
  if (month < 1 || month > 12 || year <= 0) return "";
  return `${String(month).padStart(2, "0")}/${year}`;
}

export function sanitizeMortgageStartDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/** Formate en MM/AAAA si la valeur est parseable, sinon conserve la saisie en cours. */
export function normalizeMortgageStartDate(raw: string): string {
  const parsed = parseMortgageStartDate(raw);
  if (parsed) return formatMortgageStartDate(parsed.month, parsed.year);
  return sanitizeMortgageStartDate(raw);
}

export function canComputeAmortization(draft: EmpreinteDraft): boolean {
  const principal = parseCurrency(draft.initialMortgagePrincipal ?? "");
  const durationYears = parseNumber(draft.initialMortgageDurationYears ?? "");
  const rate = parseRatePercent(draft.initialMortgageRate ?? "");
  const start = parseMortgageStartDate(draft.mortgageStartDate ?? "");
  return principal > 0 && durationYears >= 1 && durationYears <= 30 && rate > 0 && start != null;
}

/** Champs obligatoires manquants ou invalides pour l'estimation. */
export function getFinancementEstimateMissingFields(draft: EmpreinteDraft): string[] {
  const missing: string[] = [];
  if (parseCurrency(draft.initialMortgagePrincipal ?? "") <= 0) {
    missing.push("capital emprunté");
  }
  if (!parseMortgageStartDate(draft.mortgageStartDate ?? "")) {
    const partial = (draft.mortgageStartDate ?? "").replace(/\D/g, "");
    if (partial.length > 0 && partial.length < 6) {
      missing.push("date de souscription — année incomplète (4 chiffres, ex. 01/2021)");
    } else {
      missing.push("date de souscription (MM/AAAA, ex. 01/2021)");
    }
  }
  const years = parseNumber(draft.initialMortgageDurationYears ?? "");
  if (years < 1 || years > 30) {
    missing.push("durée du prêt (1–30 ans)");
  }
  if (parseRatePercent(draft.initialMortgageRate ?? "") <= 0) {
    missing.push("taux d'intérêt");
  }
  return missing;
}

export function computeFinancementFromAmortization(
  draft: EmpreinteDraft,
  asOfDate = new Date()
) {
  if (!canComputeAmortization(draft)) return null;

  const start = parseMortgageStartDate(draft.mortgageStartDate)!;
  const insuranceMonthly = parseCurrency(draft.mortgageInsuranceMonthly);
  const insuranceAnnualRate = DEFAULT_MORTGAGE_INSURANCE_ANNUAL_RATE;

  return calculateAmortization({
    principal: parseCurrency(draft.initialMortgagePrincipal),
    annualRate: parseRatePercent(draft.initialMortgageRate),
    durationYears: parseNumber(draft.initialMortgageDurationYears),
    startMonth: start.month,
    startYear: start.year,
    asOfDate,
    insuranceAnnualRate,
    monthlyInsuranceEuro: insuranceMonthly > 0 ? insuranceMonthly : undefined,
  });
}

export function amortizationToDraftFields(
  result: ReturnType<typeof calculateAmortization>
): Pick<
  EmpreinteDraft,
  "mortgageRemaining" | "monthlyMortgagePayment" | "mortgageRemainingYears"
> {
  const fmt = (n: number) => (n > 0 ? Math.round(n).toLocaleString("fr-FR") : "0");
  return {
    mortgageRemaining: fmt(result.remainingBalance),
    monthlyMortgagePayment: fmt(result.monthlyPaymentTotal),
    mortgageRemainingYears:
      result.remainingYears > 0 ? String(result.remainingYears) : "0",
  };
}

/** Valeurs numériques prêtes pour le store (estimation ou sans crédit). */
export interface ResolvedFinancementValues {
  mortgageRemaining: number;
  monthlyMortgagePayment: number;
  mortgageRemainingYears: number;
  initialMortgagePrincipal: number;
  initialMortgageDurationYears: number;
  mortgageStartMonth: number;
  mortgageStartYear: number;
  initialMortgageRate: number;
  mortgageInsuranceMonthly: number;
}

export function resolveFinancementValues(draft: EmpreinteDraft): ResolvedFinancementValues {
  if (draft.financementNoCredit === "1") {
    return {
      mortgageRemaining: 0,
      monthlyMortgagePayment: 0,
      mortgageRemainingYears: 0,
      initialMortgagePrincipal: 0,
      initialMortgageDurationYears: 0,
      mortgageStartMonth: 0,
      mortgageStartYear: 0,
      initialMortgageRate: 0,
      mortgageInsuranceMonthly: 0,
    };
  }

  const start = parseMortgageStartDate(draft.mortgageStartDate);
  const origin = {
    initialMortgagePrincipal: parseCurrency(draft.initialMortgagePrincipal),
    initialMortgageDurationYears: parseNumber(draft.initialMortgageDurationYears),
    mortgageStartMonth: start?.month ?? 0,
    mortgageStartYear: start?.year ?? 0,
    initialMortgageRate: parseRatePercent(draft.initialMortgageRate),
    mortgageInsuranceMonthly: parseCurrency(draft.mortgageInsuranceMonthly),
  };

  const computed = computeFinancementFromAmortization(draft);
  if (computed) {
    return {
      mortgageRemaining: computed.remainingBalance,
      monthlyMortgagePayment: computed.monthlyPaymentTotal,
      mortgageRemainingYears: computed.remainingYears,
      ...origin,
    };
  }

  return {
    mortgageRemaining: 0,
    monthlyMortgagePayment: 0,
    mortgageRemainingYears: 0,
    ...origin,
  };
}
