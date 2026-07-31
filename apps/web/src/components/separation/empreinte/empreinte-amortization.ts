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

/** Valide et parse MM/AAAA (mois 1–12). */
export function parseMortgageStartDate(raw: string): { month: number; year: number } | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{1,2})\s*\/\s*(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const year = Number(match[2]);
  if (month < 1 || month > 12 || year < 1990 || year > 2100) return null;
  return { month, year };
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

export function canComputeAmortization(draft: EmpreinteDraft): boolean {
  const principal = parseCurrency(draft.initialMortgagePrincipal);
  const durationYears = parseNumber(draft.initialMortgageDurationYears);
  const rate = parseRatePercent(draft.initialMortgageRate);
  const start = parseMortgageStartDate(draft.mortgageStartDate);
  return principal > 0 && durationYears >= 1 && durationYears <= 30 && rate > 0 && start != null;
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
