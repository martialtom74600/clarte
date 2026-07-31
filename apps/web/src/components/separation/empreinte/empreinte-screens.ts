import type { FootprintField, FootprintState } from "@/lib/separation/separation-types";
import { parseCurrency, parseNumber } from "./empreinte-field";

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

export type EmpreinteDraft = Record<FootprintField, string>;

export function footprintToDraft(footprint: FootprintState): EmpreinteDraft {
  const fmt = (n: number) => (n > 0 ? n.toLocaleString("fr-FR") : "");
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
    incomeA: footprint.incomeA > 0 ? fmt(footprint.incomeA) : "",
    incomeB: footprint.incomeB > 0 ? fmt(footprint.incomeB) : "",
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

/** CRD saisi ; si > 0, mensualité + durée restantes obligatoires. */
export function isFinancementValid(draft: EmpreinteDraft): boolean {
  if (draft.mortgageRemaining.trim() === "") return false;
  const crd = parseCurrency(draft.mortgageRemaining);
  if (crd < 0) return false;
  if (crd === 0) return true;
  const monthly = parseCurrency(draft.monthlyMortgagePayment);
  const years = parseNumber(draft.mortgageRemainingYears);
  return monthly > 0 && years >= 1 && years <= 30;
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
  return draft.mortgageRemaining.trim() !== "" && parseCurrency(draft.mortgageRemaining) > 0;
}
