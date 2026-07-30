import type { NewLifeCapInput, NewLifeCapResult } from "@separation/schemas";
import { computeNewLifeCap } from "@separation/engine";
import type { WizardState } from "./wizard-state";

export function buildNewLifeCapInput(
  state: WizardState,
  netWorthA: number,
  netWorthB: number,
  soulteAmount?: number,
  soultePayer?: NewLifeCapInput["soultePayer"],
  zoneOverrides?: Partial<
    Pick<
      NewLifeCapInput,
      | "zoneMedianPricePerSqm"
      | "zoneMinPricePerSqm"
      | "zoneMaxPricePerSqm"
      | "zoneDepartments"
    >
  >
): NewLifeCapInput | null {
  if (!state.postalCode || state.postalCode.length < 5 || !state.intent) return null;
  if (state.propertyValue <= 0) return null;

  return {
    postalCode: state.postalCode,
    propertyValue: state.propertyValue,
    propertySurface: state.propertySurface > 0 ? state.propertySurface : 65,
    mortgageRemaining: state.mortgageRemaining,
    monthlyMortgagePayment: state.monthlyMortgagePayment,
    contributionA: state.contributionA,
    contributionB: state.contributionB,
    incomeAMonthly: state.incomeAMonthly,
    incomeBMonthly: state.incomeBMonthly,
    netWorthA,
    netWorthB,
    intent: state.intent,
    soulteAmount,
    soultePayer,
    ...zoneOverrides,
  };
}

export function computeNewLifeCapFromState(
  state: WizardState,
  netWorthA: number,
  netWorthB: number,
  soulteAmount?: number,
  soultePayer?: NewLifeCapInput["soultePayer"],
  zoneOverrides?: Partial<
    Pick<
      NewLifeCapInput,
      | "zoneMedianPricePerSqm"
      | "zoneMinPricePerSqm"
      | "zoneMaxPricePerSqm"
      | "zoneDepartments"
    >
  >
): NewLifeCapResult | null {
  const input = buildNewLifeCapInput(
    state,
    netWorthA,
    netWorthB,
    soulteAmount,
    soultePayer,
    zoneOverrides
  );
  if (!input) return null;
  return computeNewLifeCap(input);
}

export const VERDICT_LABELS = {
  green: "Tenable",
  orange: "Serré",
  red: "Difficile",
} as const;

export const VERDICT_STYLES = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  orange: "border-amber-200 bg-amber-50 text-amber-900",
  red: "border-rose-200 bg-rose-50 text-rose-900",
} as const;
