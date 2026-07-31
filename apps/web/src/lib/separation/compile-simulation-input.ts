import type {
  AssumptionsState,
  FootprintState,
  LabState,
  SeparationState,
} from "./separation-types";
import type { LeverId, SimulationInput } from "@separation/schemas";
import { getMortgageRateSnapshot } from "@separation/engine";

const DEFAULT_SURFACE = 65;

function mergeAssumptionsWithLevers(
  assumptions: AssumptionsState,
  lab: LabState
): AssumptionsState {
  const merged = { ...assumptions };
  const enabled = new Set(lab.enabledLevers);
  const overrides = lab.overrides;

  if (enabled.has("initial_contributions") && overrides.initial_contributions) {
    merged.contributionA = overrides.initial_contributions.contributionA;
    merged.contributionB = overrides.initial_contributions.contributionB;
  }
  if (enabled.has("historical_mortgage_rate") && overrides.historical_mortgage_rate) {
    merged.monthlyMortgagePayment = overrides.historical_mortgage_rate.monthlyMortgagePayment;
    if (overrides.historical_mortgage_rate.mortgageRate != null) {
      merged.mortgageRate = overrides.historical_mortgage_rate.mortgageRate;
    }
  }
  if (enabled.has("children_impact") && overrides.children_impact) {
    merged.hasMinorChildren = overrides.children_impact.hasMinorChildren;
    merged.numberOfChildren = overrides.children_impact.numberOfChildren;
    merged.custodyType = overrides.children_impact.custodyType;
  }
  if (enabled.has("legal_status") && overrides.legal_status) {
    merged.status = overrides.legal_status.status;
    if (overrides.legal_status.marriageRegime) {
      merged.marriageRegime = overrides.legal_status.marriageRegime;
    }
  }
  if (enabled.has("ownership_shares") && overrides.ownership_shares) {
    merged.shareA = overrides.ownership_shares.shareA;
    merged.shareB = overrides.ownership_shares.shareB;
  }
  if (enabled.has("savings") && overrides.savings) {
    merged.savingsA = overrides.savings.savingsA;
    merged.savingsB = overrides.savings.savingsB;
  }

  return merged;
}

function buildAssetsAndLiabilities(
  footprint: FootprintState,
  merged: AssumptionsState
): Pick<SimulationInput, "assets" | "liabilities"> {
  const shareA = merged.shareA / 100;
  const shareB = merged.shareB / 100;
  const assets: SimulationInput["assets"] = [];
  const liabilities: SimulationInput["liabilities"] = [];

  if (footprint.propertyValue > 0) {
    assets.push({
      id: "primary-residence",
      type: "real_estate",
      label: "Résidence principale",
      grossValue: { amount: footprint.propertyValue, currency: "EUR" },
      ownership:
        merged.status === "marriage" && merged.marriageRegime === "communaute_legale"
          ? { kind: "community" }
          : { kind: "indivision", shares: { A: shareA, B: shareB } },
      isPrimaryResidence: true,
      linkedLiabilityIds: footprint.mortgageRemaining > 0 ? ["mortgage"] : undefined,
    });
  }

  if (merged.savingsA > 0) {
    assets.push({
      id: "savings-a",
      type: "savings",
      label: "Épargne personne A",
      grossValue: { amount: merged.savingsA, currency: "EUR" },
      ownership: { kind: "own", owner: "A" },
    });
  }

  if (merged.savingsB > 0) {
    assets.push({
      id: "savings-b",
      type: "savings",
      label: "Épargne personne B",
      grossValue: { amount: merged.savingsB, currency: "EUR" },
      ownership: { kind: "own", owner: "B" },
    });
  }

  if (footprint.mortgageRemaining > 0) {
    liabilities.push({
      id: "mortgage",
      type: "mortgage",
      label: "Crédit immobilier",
      remainingBalance: { amount: footprint.mortgageRemaining, currency: "EUR" },
      responsibility:
        merged.status === "marriage" && merged.marriageRegime === "communaute_legale"
          ? { kind: "community" }
          : { kind: "indivision", shares: { A: shareA, B: shareB } },
      linkedAssetId: "primary-residence",
    });
  }

  return { assets, liabilities };
}

/** Fusion footprint + assumptions + leviers actifs → SimulationInput moteur. */
export function compileSimulationInput(
  state: Pick<SeparationState, "footprint" | "assumptions" | "lab">
): SimulationInput {
  const { footprint, lab } = state;
  const merged = mergeAssumptionsWithLevers(state.assumptions, lab);
  const { assets, liabilities } = buildAssetsAndLiabilities(footprint, merged);

  const monthlyRentOverride =
    lab.enabledLevers.includes("custom_rent") &&
    lab.overrides.custom_rent?.monthlyRentOverride != null
      ? lab.overrides.custom_rent.monthlyRentOverride
      : undefined;

  const contributionsActive = lab.enabledLevers.includes("initial_contributions");
  const historicalActive = lab.enabledLevers.includes("historical_mortgage_rate");
  const occupationActive = lab.enabledLevers.includes("occupation_indemnity");
  const occupationMonths =
    occupationActive && (lab.overrides.occupation_indemnity?.occupationMonths ?? 0) > 0
      ? lab.overrides.occupation_indemnity!.occupationMonths
      : undefined;
  const childrenActive =
    lab.enabledLevers.includes("children_impact") &&
    Boolean(lab.overrides.children_impact?.hasMinorChildren) &&
    (lab.overrides.children_impact?.numberOfChildren ?? 0) > 0;

  return {
    status: merged.status,
    marriageRegime: merged.status === "marriage" ? merged.marriageRegime : undefined,
    persons: [
      {
        id: "A",
        income:
          footprint.incomeA > 0
            ? { amount: footprint.incomeA, currency: "EUR" }
            : undefined,
      },
      {
        id: "B",
        income:
          footprint.incomeB > 0
            ? { amount: footprint.incomeB, currency: "EUR" }
            : undefined,
      },
    ],
    assets,
    liabilities,
    options: {
      primaryResidenceId: footprint.propertyValue > 0 ? "primary-residence" : undefined,
      scenario: "compare_all",
      mortgageRate: merged.mortgageRate,
      mortgageDurationYears: merged.mortgageDurationYears,
      monthlyRentOverride,
      occupationMonths,
    },
    hasMinorChildren: childrenActive,
    numberOfChildren: childrenActive
      ? lab.overrides.children_impact!.numberOfChildren
      : undefined,
    custodyType: childrenActive ? lab.overrides.children_impact!.custodyType : undefined,
    postalCode: footprint.postalCode,
    propertySurface: merged.propertySurface || DEFAULT_SURFACE,
    contributionA: contributionsActive ? merged.contributionA : undefined,
    contributionB: contributionsActive ? merged.contributionB : undefined,
    // Mensualité actuelle : active le mode « garder mon crédit » (keep) + loyer net (rent_out).
    monthlyMortgagePayment: historicalActive
      ? lab.overrides.historical_mortgage_rate?.monthlyMortgagePayment
      : undefined,
  };
}

export function isFootprintComplete(footprint: FootprintState): boolean {
  return (
    footprint.postalCode.length >= 5 &&
    footprint.propertyValue > 0 &&
    footprint.mortgageRemaining >= 0 &&
    footprint.incomeA > 0 &&
    footprint.incomeB > 0
  );
}

export function defaultAssumptions(): AssumptionsState {
  const rate = getMortgageRateSnapshot(20);
  return {
    status: "concubinage",
    shareA: 50,
    shareB: 50,
    marriageRegime: "communaute_legale",
    mortgageRate: rate.annualRate,
    mortgageDurationYears: rate.durationYears,
    hasMinorChildren: false,
    numberOfChildren: 0,
    custodyType: "classic",
    contributionA: 0,
    contributionB: 0,
    propertySurface: DEFAULT_SURFACE,
    monthlyMortgagePayment: 0,
    savingsA: 0,
    savingsB: 0,
  };
}

export function defaultLabState(): LabState {
  return {
    activeDoor: null,
    enabledLevers: [],
    overrides: {},
  };
}

export function leverRequiresOverride(leverId: LeverId): boolean {
  return leverId !== "children_impact";
}
