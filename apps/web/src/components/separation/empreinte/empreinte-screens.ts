import type { FootprintField, FootprintState } from "@/lib/separation/separation-types";
import { parseCurrency, parseNumber } from "./empreinte-field";
import {
  canComputeAmortization,
  computeFinancementFromAmortization,
  formatMortgageStartDate,
  formatRatePercent,
} from "./empreinte-amortization";

export const EMPREINTE_SCREEN_COUNT = 5;
export const EMPREINTE_STEP_KEY = "clarte-empreinte-screen";

export type EmpreinteScreenId =
  | "location"
  | "patrimoine"
  | "financement"
  | "income_a"
  | "income_b";

export const EMPREINTE_SCREENS: EmpreinteScreenId[] = [
  "location",
  "patrimoine",
  "financement",
  "income_a",
  "income_b",
];

/** Libellés courts pour la barre de progression (5 étapes). */
export const EMPREINTE_SCREEN_LABELS: Record<EmpreinteScreenId, string> = {
  location: "Localisation",
  patrimoine: "Patrimoine",
  financement: "Financement",
  income_a: "Vos revenus",
  income_b: "Ses revenus",
};

/** Champs persistés + brouillon UI financement (mode manuel). */
export type EmpreinteDraft = Record<FootprintField, string> & {
  mortgageStartDate: string;
  financementManual: string;
};

export function emptyEmpreinteDraft(overrides: Partial<EmpreinteDraft> = {}): EmpreinteDraft {
  return {
    postalCode: "",
    propertyValue: "",
    propertySurface: "",
    purchasePrice: "",
    mortgageRemaining: "",
    monthlyMortgagePayment: "",
    mortgageRemainingYears: "",
    initialMortgagePrincipal: "",
    initialMortgageDurationYears: "",
    mortgageStartMonth: "",
    mortgageStartYear: "",
    mortgageStartDate: "",
    initialMortgageRate: "",
    mortgageInsuranceRate: "",
    mortgageInsuranceMonthly: "",
    incomeA: "",
    incomeB: "",
    financementManual: "",
    ...overrides,
  };
}

export function footprintToDraft(footprint: FootprintState): EmpreinteDraft {
  const fmt = (n: number) => (n > 0 ? n.toLocaleString("fr-FR") : "");
  const startDate = formatMortgageStartDate(
    footprint.mortgageStartMonth,
    footprint.mortgageStartYear
  );
  const hasSmartOrigin =
    footprint.initialMortgagePrincipal > 0 &&
    footprint.initialMortgageRate > 0 &&
    footprint.mortgageStartMonth >= 1;

  return {
    postalCode: footprint.postalCode,
    propertyValue: footprint.propertyValue > 0 ? fmt(footprint.propertyValue) : "",
    propertySurface: footprint.propertySurface > 0 ? String(footprint.propertySurface) : "",
    purchasePrice:
      footprint.purchasePrice > 0
        ? fmt(footprint.purchasePrice)
        : footprint.completedAt
          ? "0"
          : "",
    mortgageRemaining:
      footprint.mortgageRemaining > 0
        ? fmt(footprint.mortgageRemaining)
        : footprint.incomeA > 0 || footprint.completedAt
          ? "0"
          : "",
    monthlyMortgagePayment:
      footprint.monthlyMortgagePayment > 0 ? fmt(footprint.monthlyMortgagePayment) : "",
    mortgageRemainingYears:
      footprint.mortgageRemainingYears > 0 ? String(footprint.mortgageRemainingYears) : "",
    initialMortgagePrincipal:
      footprint.initialMortgagePrincipal > 0
        ? fmt(footprint.initialMortgagePrincipal)
        : footprint.purchasePrice > 0
          ? fmt(footprint.purchasePrice)
          : "",
    initialMortgageDurationYears:
      footprint.initialMortgageDurationYears > 0
        ? String(footprint.initialMortgageDurationYears)
        : "",
    mortgageStartMonth:
      footprint.mortgageStartMonth > 0 ? String(footprint.mortgageStartMonth) : "",
    mortgageStartYear:
      footprint.mortgageStartYear > 0 ? String(footprint.mortgageStartYear) : "",
    mortgageStartDate: startDate,
    initialMortgageRate:
      footprint.initialMortgageRate > 0
        ? formatRatePercent(footprint.initialMortgageRate)
        : "",
    mortgageInsuranceRate: "",
    mortgageInsuranceMonthly:
      footprint.mortgageInsuranceMonthly > 0
        ? fmt(footprint.mortgageInsuranceMonthly)
        : "",
    incomeA: footprint.incomeA > 0 ? fmt(footprint.incomeA) : "",
    incomeB: footprint.incomeB > 0 ? fmt(footprint.incomeB) : "",
    financementManual: hasSmartOrigin ? "" : footprint.mortgageRemaining >= 0 ? "1" : "",
  };
}

export function isLocationValid(draft: EmpreinteDraft): boolean {
  return draft.postalCode.replace(/\D/g, "").length === 5;
}

export function isPatrimoineValid(draft: EmpreinteDraft): boolean {
  const surface = parseNumber(draft.propertySurface);
  const value = parseCurrency(draft.propertyValue);
  const purchaseFilled = draft.purchasePrice.trim() !== "";
  const purchase = parseCurrency(draft.purchasePrice);
  return surface > 0 && value > 0 && purchaseFilled && purchase >= 0;
}

function isManualFinancementValid(draft: EmpreinteDraft): boolean {
  if (draft.mortgageRemaining.trim() === "") return false;
  const crd = parseCurrency(draft.mortgageRemaining);
  if (crd < 0) return false;
  if (crd === 0) return true;
  const monthly = parseCurrency(draft.monthlyMortgagePayment);
  const years = parseNumber(draft.mortgageRemainingYears);
  return monthly > 0 && years >= 1 && years <= 30;
}

function isSmartFinancementValid(draft: EmpreinteDraft): boolean {
  if (!canComputeAmortization(draft)) return false;
  const result = computeFinancementFromAmortization(draft);
  if (!result) return false;
  if (result.remainingBalance <= 0) return true;
  return (
    result.monthlyPaymentTotal > 0 &&
    result.remainingYears >= 1 &&
    result.remainingYears <= 30
  );
}

/** CRD saisi ou dérivé ; si > 0, mensualité + durée restantes obligatoires. */
export function isFinancementValid(draft: EmpreinteDraft): boolean {
  if (draft.mortgageRemaining.trim() !== "" && parseCurrency(draft.mortgageRemaining) === 0) {
    return true;
  }
  if (draft.financementManual === "1") {
    return isManualFinancementValid(draft);
  }
  if (isSmartFinancementValid(draft)) return true;
  return isManualFinancementValid(draft);
}

export function isIncomeValid(draft: EmpreinteDraft, field: "incomeA" | "incomeB"): boolean {
  return parseCurrency(draft[field]) > 0;
}

export function isScreenValid(screen: EmpreinteScreenId, draft: EmpreinteDraft): boolean {
  switch (screen) {
    case "location":
      return isLocationValid(draft);
    case "patrimoine":
      return isPatrimoineValid(draft);
    case "financement":
      return isFinancementValid(draft);
    case "income_a":
      return isIncomeValid(draft, "incomeA");
    case "income_b":
      return isIncomeValid(draft, "incomeB");
  }
}

export function inferEmpreinteScreen(footprint: FootprintState): number {
  const saved =
    typeof window !== "undefined" ? sessionStorage.getItem(EMPREINTE_STEP_KEY) : null;
  const savedStep = saved != null ? Number(saved) : NaN;
  if (!Number.isNaN(savedStep) && savedStep >= 0 && savedStep < EMPREINTE_SCREEN_COUNT) {
    return savedStep;
  }

  if (footprint.postalCode.length < 5) return 0;
  if (footprint.propertyValue <= 0 || footprint.propertySurface <= 0) return 1;
  if (footprint.mortgageRemaining < 0) return 2;
  if (
    footprint.mortgageRemaining > 0 &&
    (footprint.monthlyMortgagePayment <= 0 || footprint.mortgageRemainingYears <= 0)
  ) {
    return 2;
  }
  if (footprint.incomeA <= 0) return 3;
  if (footprint.incomeB <= 0) return 4;
  return 0;
}

export function hasActiveLoan(draft: EmpreinteDraft): boolean {
  if (draft.mortgageRemaining.trim() !== "" && parseCurrency(draft.mortgageRemaining) === 0) {
    return false;
  }
  if (draft.financementManual !== "1" && canComputeAmortization(draft)) {
    const result = computeFinancementFromAmortization(draft);
    if (result) return result.remainingBalance > 0;
  }
  return draft.mortgageRemaining.trim() !== "" && parseCurrency(draft.mortgageRemaining) > 0;
}
