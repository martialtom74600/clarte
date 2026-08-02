import type { FootprintField, FootprintState } from "@/lib/separation/separation-types";
import type { RelationshipStatus } from "@separation/schemas";
import { parseCurrency, parseNumber } from "./empreinte-field";
import {
  canComputeAmortization,
  computeFinancementFromAmortization,
  formatMortgageStartDate,
  formatRatePercent,
} from "./empreinte-amortization";

export const EMPREINTE_SCREEN_COUNT = 6;
export const EMPREINTE_STEP_KEY = "clarte-empreinte-screen-v3";

export type EmpreinteScreenId =
  | "location"
  | "patrimoine"
  | "cadre_juridique"
  | "apports"
  | "financement"
  | "revenus";

export const EMPREINTE_SCREENS: EmpreinteScreenId[] = [
  "location",
  "patrimoine",
  "cadre_juridique",
  "apports",
  "financement",
  "revenus",
];

/** Libellés courts pour la barre de progression (6 étapes). */
export const EMPREINTE_SCREEN_LABELS: Record<EmpreinteScreenId, string> = {
  location: "Localisation",
  patrimoine: "Patrimoine",
  cadre_juridique: "Cadre juridique",
  apports: "Apports",
  financement: "Financement",
  revenus: "Revenus",
};

export const LEGAL_STATUS_OPTIONS: {
  value: RelationshipStatus;
  label: string;
}[] = [
  { value: "marriage", label: "Mariés" },
  { value: "pacs", label: "PACS" },
  { value: "concubinage", label: "Union libre" },
];

export const OWNERSHIP_PRESETS: { label: string; shareA: number; shareB: number }[] = [
  { label: "50 / 50", shareA: 50, shareB: 50 },
  { label: "60 / 40", shareA: 60, shareB: 40 },
  { label: "70 / 30", shareA: 70, shareB: 30 },
  { label: "80 / 20", shareA: 80, shareB: 20 },
];

/** Champs footprint saisis en texte (hors flags booléens déclaratifs). */
export type EmpreinteDraftField = Exclude<
  FootprintField,
  "apportsDeclared" | "financementDeclared" | "cadreJuridiqueDeclared"
>;

/** Champs persistés + brouillon UI financement (sans crédit). */
export type EmpreinteDraft = Record<EmpreinteDraftField, string> & {
  mortgageStartDate: string;
  /** "1" = l'utilisateur a indiqué n'avoir plus de crédit. */
  financementNoCredit: string;
};

export function parseSharePercent(raw: string | undefined): number {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return 0;
  return Math.min(100, Math.max(0, Number(digits)));
}

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
    contributionA: "",
    contributionB: "",
    legalStatus: "",
    ownershipShareA: "50",
    ownershipShareB: "50",
    financementNoCredit: "",
    ...overrides,
  };
}

export function footprintToDraft(footprint: FootprintState): EmpreinteDraft {
  const fmt = (n: number) => (n > 0 ? n.toLocaleString("fr-FR") : "");
  const startDate = formatMortgageStartDate(
    footprint.mortgageStartMonth,
    footprint.mortgageStartYear
  );

  return {
    postalCode: footprint.postalCode,
    propertyValue: footprint.propertyValue > 0 ? fmt(footprint.propertyValue) : "",
    propertySurface: footprint.propertySurface > 0 ? String(footprint.propertySurface) : "",
    purchasePrice: footprint.purchasePrice > 0 ? fmt(footprint.purchasePrice) : "",
    mortgageRemaining:
      footprint.mortgageRemaining > 0
        ? fmt(footprint.mortgageRemaining)
        : footprint.completedAt || footprint.contributionA > 0 || footprint.contributionB > 0
          ? "0"
          : "",
    monthlyMortgagePayment:
      footprint.monthlyMortgagePayment > 0 ? fmt(footprint.monthlyMortgagePayment) : "",
    mortgageRemainingYears:
      footprint.mortgageRemainingYears > 0 ? String(footprint.mortgageRemainingYears) : "",
    initialMortgagePrincipal:
      footprint.initialMortgagePrincipal > 0 ? fmt(footprint.initialMortgagePrincipal) : "",
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
    contributionA: footprint.contributionA > 0 ? fmt(footprint.contributionA) : "",
    contributionB: footprint.contributionB > 0 ? fmt(footprint.contributionB) : "",
    legalStatus: footprint.legalStatus ?? "",
    ownershipShareA:
      footprint.cadreJuridiqueDeclared || footprint.ownershipShareA > 0
        ? String(footprint.ownershipShareA)
        : "50",
    ownershipShareB:
      footprint.cadreJuridiqueDeclared || footprint.ownershipShareB > 0
        ? String(footprint.ownershipShareB)
        : "50",
    financementNoCredit:
      footprint.financementDeclared &&
      footprint.mortgageRemaining === 0 &&
      footprint.initialMortgagePrincipal === 0
        ? "1"
        : "",
  };
}

export function isLocationValid(draft: EmpreinteDraft): boolean {
  return (draft.postalCode ?? "").replace(/\D/g, "").length === 5;
}

export function isPatrimoineValid(draft: EmpreinteDraft): boolean {
  const surface = parseNumber(draft.propertySurface);
  const value = parseCurrency(draft.propertyValue);
  return surface > 0 && value > 0;
}

export function isCadreJuridiqueValid(draft: EmpreinteDraft): boolean {
  const status = draft.legalStatus;
  if (status !== "marriage" && status !== "pacs" && status !== "concubinage") {
    return false;
  }
  const shareA = parseSharePercent(draft.ownershipShareA);
  const shareB = parseSharePercent(draft.ownershipShareB);
  return shareA > 0 && shareB > 0 && shareA + shareB === 100;
}

function isEstimateFinancementValid(draft: EmpreinteDraft): boolean {
  return canComputeAmortization(draft);
}

export function isFinancementNoCredit(draft: EmpreinteDraft): boolean {
  return draft.financementNoCredit === "1";
}

export type FinancementUiMode = "no_credit" | "estimate";

export function inferFinancementUiMode(draft: EmpreinteDraft): FinancementUiMode {
  if (draft.financementNoCredit === "1") return "no_credit";
  if (canComputeAmortization(draft)) return "estimate";
  return "no_credit";
}

export function isFinancementValidForMode(
  draft: EmpreinteDraft,
  mode: FinancementUiMode
): boolean {
  if (mode === "no_credit") return true;
  return isEstimateFinancementValid(draft);
}

export function isFinancementValid(draft: EmpreinteDraft): boolean {
  if (isFinancementNoCredit(draft)) return true;
  return isEstimateFinancementValid(draft);
}

export function isIncomeValid(draft: EmpreinteDraft, field: "incomeA" | "incomeB"): boolean {
  return parseCurrency(draft[field]) > 0;
}

function isContributionValid(value: string | undefined): boolean {
  if (!value || value.trim() === "") return true;
  return parseCurrency(value) >= 0;
}

export function isApportsValid(draft: EmpreinteDraft): boolean {
  return isContributionValid(draft.contributionA) && isContributionValid(draft.contributionB);
}

export function isRevenusValid(draft: EmpreinteDraft): boolean {
  return isIncomeValid(draft, "incomeA") && isIncomeValid(draft, "incomeB");
}

export function isScreenValid(screen: EmpreinteScreenId, draft: EmpreinteDraft): boolean {
  switch (screen) {
    case "location":
      return isLocationValid(draft);
    case "patrimoine":
      return isPatrimoineValid(draft);
    case "cadre_juridique":
      return isCadreJuridiqueValid(draft);
    case "apports":
      return isApportsValid(draft);
    case "financement":
      return isFinancementValid(draft);
    case "revenus":
      return isRevenusValid(draft);
  }
}

export function isFinancementCompleteInFootprint(footprint: FootprintState): boolean {
  if (footprint.financementDeclared) return true;

  if (footprint.mortgageRemaining > 0) {
    return (
      footprint.monthlyMortgagePayment > 0 &&
      footprint.mortgageRemainingYears >= 1 &&
      footprint.mortgageRemainingYears <= 30
    );
  }

  if (footprint.initialMortgagePrincipal > 0) return true;

  if (footprint.mortgageStartMonth > 0 && footprint.mortgageStartYear > 0) {
    return true;
  }

  return false;
}

export function isApportsCompleteInFootprint(footprint: FootprintState): boolean {
  return footprint.apportsDeclared;
}

export function isCadreJuridiqueCompleteInFootprint(footprint: FootprintState): boolean {
  return footprint.cadreJuridiqueDeclared;
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
  if (!isCadreJuridiqueCompleteInFootprint(footprint)) return 2;
  if (!isApportsCompleteInFootprint(footprint)) return 3;
  if (!isFinancementCompleteInFootprint(footprint)) return 4;
  if (footprint.incomeA <= 0 || footprint.incomeB <= 0) return 5;
  return 5;
}

/** Message d'aide quand « Continuer » est désactivé ou avant validation. */
export function getScreenValidationHint(
  screen: EmpreinteScreenId,
  draft: EmpreinteDraft
): string | null {
  if (isScreenValid(screen, draft)) return null;

  switch (screen) {
    case "location": {
      const len = (draft.postalCode ?? "").replace(/\D/g, "").length;
      if (len === 0) return "Indiquez le code postal du bien (5 chiffres).";
      return "Le code postal doit comporter 5 chiffres.";
    }
    case "patrimoine": {
      const missing: string[] = [];
      if (parseNumber(draft.propertySurface) <= 0) missing.push("la surface habitable");
      if (parseCurrency(draft.propertyValue) <= 0) missing.push("la valeur estimée");
      if (missing.length === 0) return null;
      return `Indiquez ${missing.join(" et ")}.`;
    }
    case "cadre_juridique": {
      if (
        draft.legalStatus !== "marriage" &&
        draft.legalStatus !== "pacs" &&
        draft.legalStatus !== "concubinage"
      ) {
        return "Choisissez votre statut (mariés, PACS ou union libre).";
      }
      return "Les deux parts doivent totaliser 100 %.";
    }
    case "apports":
      return null;
    case "financement":
      return null;
    case "revenus": {
      const missing: string[] = [];
      if (!isIncomeValid(draft, "incomeA")) missing.push("vos revenus");
      if (!isIncomeValid(draft, "incomeB")) missing.push("ceux de l'autre");
      if (missing.length === 0) return null;
      return `Indiquez ${missing.join(" et ")} (net mensuel).`;
    }
  }
}

export function hasActiveLoan(draft: EmpreinteDraft): boolean {
  if (isFinancementNoCredit(draft)) return false;
  const result = computeFinancementFromAmortization(draft);
  return result != null && result.remainingBalance > 0;
}
