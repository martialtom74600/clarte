import type {
  AssumptionsState,
  FootprintState,
  LabState,
  SeparationState,
} from "./separation-types";
import type { LeverId, SimulationInput } from "@separation/schemas";
import {
  DEFAULT_MORTGAGE_DURATION_YEARS,
  DEFAULT_MORTGAGE_INSURANCE_ANNUAL_RATE,
  defaultRelocateSurfaceSqm,
  getMortgageRateSnapshot,
} from "@separation/engine";

const DEFAULT_SURFACE = 65;

function applyFootprintAssumptions(
  footprint: FootprintState,
  assumptions: AssumptionsState
): AssumptionsState {
  if (!footprint.cadreJuridiqueDeclared || !footprint.legalStatus) {
    return assumptions;
  }
  return {
    ...assumptions,
    status: footprint.legalStatus,
    shareA: footprint.ownershipShareA,
    shareB: footprint.ownershipShareB,
  };
}

function mergeAssumptionsWithLevers(
  assumptions: AssumptionsState,
  lab: LabState,
  footprint: FootprintState
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
    const rate =
      overrides.historical_mortgage_rate.mortgageRate ??
      (footprint.initialMortgageRate > 0 ? footprint.initialMortgageRate : undefined);
    if (rate != null) {
      merged.mortgageRate = rate;
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

function resolveIndivisionShares(
  footprint: FootprintState,
  merged: AssumptionsState
): { A: number; B: number } {
  if (footprint.cadreJuridiqueDeclared) {
    return {
      A: footprint.ownershipShareA / 100,
      B: footprint.ownershipShareB / 100,
    };
  }
  return { A: merged.shareA / 100, B: merged.shareB / 100 };
}

function resolvePropertyOwnership(
  footprint: FootprintState,
  merged: AssumptionsState
): SimulationInput["assets"][number]["ownership"] {
  // L'acte de vente (empreinte) prime sur le régime matrimonial par défaut.
  if (footprint.cadreJuridiqueDeclared) {
    const shares = resolveIndivisionShares(footprint, merged);
    return { kind: "indivision", shares };
  }
  if (merged.status === "marriage" && merged.marriageRegime === "communaute_legale") {
    return { kind: "community" };
  }
  const shares = resolveIndivisionShares(footprint, merged);
  return { kind: "indivision", shares };
}

function resolveMortgageResponsibility(
  footprint: FootprintState,
  merged: AssumptionsState
): SimulationInput["liabilities"][number]["responsibility"] {
  if (footprint.cadreJuridiqueDeclared) {
    const shares = resolveIndivisionShares(footprint, merged);
    return { kind: "indivision", shares };
  }
  if (merged.status === "marriage" && merged.marriageRegime === "communaute_legale") {
    return { kind: "community" };
  }
  const shares = resolveIndivisionShares(footprint, merged);
  return { kind: "indivision", shares };
}

function buildAssetsAndLiabilities(
  footprint: FootprintState,
  merged: AssumptionsState
): Pick<SimulationInput, "assets" | "liabilities"> {
  const assets: SimulationInput["assets"] = [];
  const liabilities: SimulationInput["liabilities"] = [];

  if (footprint.propertyValue > 0) {
    assets.push({
      id: "primary-residence",
      type: "real_estate",
      label: "Résidence principale",
      grossValue: { amount: footprint.propertyValue, currency: "EUR" },
      ownership: resolvePropertyOwnership(footprint, merged),
      isPrimaryResidence: true,
      linkedLiabilityIds: footprint.mortgageRemaining > 0 ? ["mortgage"] : undefined,
      ...(footprint.purchasePrice > 0
        ? { purchasePrice: { amount: footprint.purchasePrice, currency: "EUR" as const } }
        : {}),
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
      responsibility: resolveMortgageResponsibility(footprint, merged),
      linkedAssetId: "primary-residence",
    });
  }

  return { assets, liabilities };
}

/** Mensualité crédit : levier labo prioritaire, sinon empreinte. */
function resolveMonthlyMortgagePayment(
  footprint: FootprintState,
  merged: AssumptionsState,
  lab: LabState
): number | undefined {
  const historicalActive = lab.enabledLevers.includes("historical_mortgage_rate");
  if (historicalActive && lab.overrides.historical_mortgage_rate) {
    const v = lab.overrides.historical_mortgage_rate.monthlyMortgagePayment;
    return v > 0 ? v : undefined;
  }
  if (footprint.monthlyMortgagePayment > 0) return footprint.monthlyMortgagePayment;
  if (merged.monthlyMortgagePayment > 0) return merged.monthlyMortgagePayment;
  return undefined;
}

/** Durée restante emprunt → horizon du refinancement / nouveau prêt. */
function resolveMortgageDurationYears(
  footprint: FootprintState,
  merged: AssumptionsState
): number {
  if (footprint.mortgageRemainingYears >= 1 && footprint.mortgageRemainingYears <= 30) {
    return footprint.mortgageRemainingYears;
  }
  if (merged.mortgageDurationYears >= 1 && merged.mortgageDurationYears <= 30) {
    return merged.mortgageDurationYears;
  }
  return DEFAULT_MORTGAGE_DURATION_YEARS;
}

/** Fusion footprint + assumptions + leviers actifs → SimulationInput moteur. */
export function compileSimulationInput(
  state: Pick<SeparationState, "footprint" | "assumptions" | "lab"> & {
    marketBuy?: SeparationState["marketBuy"];
    marketRent?: SeparationState["marketRent"];
  }
): SimulationInput {
  const { footprint, lab, marketBuy = null, marketRent = null } = state;
  const assumptionsFromFootprint = applyFootprintAssumptions(footprint, state.assumptions);
  const merged = mergeAssumptionsWithLevers(assumptionsFromFootprint, lab, footprint);
  const { assets, liabilities } = buildAssetsAndLiabilities(footprint, merged);

  const monthlyRentOverride =
    lab.enabledLevers.includes("custom_rent") &&
    lab.overrides.custom_rent?.monthlyRentOverride != null
      ? lab.overrides.custom_rent.monthlyRentOverride
      : undefined;

  const relocateHousingActive = lab.enabledLevers.includes("relocate_housing");
  const relocateSurfaceSqm =
    relocateHousingActive && lab.overrides.relocate_housing?.surfaceSqm != null
      ? lab.overrides.relocate_housing.surfaceSqm
      : undefined;
  const relocateMarketTier =
    relocateHousingActive && lab.overrides.relocate_housing?.marketTier
      ? lab.overrides.relocate_housing.marketTier
      : undefined;

  const contributionsActive = lab.enabledLevers.includes("initial_contributions");
  const occupationActive = lab.enabledLevers.includes("occupation_indemnity");
  const occupationMonths =
    occupationActive && (lab.overrides.occupation_indemnity?.occupationMonths ?? 0) > 0
      ? lab.overrides.occupation_indemnity!.occupationMonths
      : undefined;
  const childrenActive =
    lab.enabledLevers.includes("children_impact") &&
    Boolean(lab.overrides.children_impact?.hasMinorChildren) &&
    (lab.overrides.children_impact?.numberOfChildren ?? 0) > 0;

  const surface =
    footprint.propertySurface > 0
      ? footprint.propertySurface
      : merged.propertySurface || DEFAULT_SURFACE;
  const monthlyMortgagePayment = resolveMonthlyMortgagePayment(footprint, merged, lab);
  const mortgageDurationYears = resolveMortgageDurationYears(footprint, merged);

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
      mortgageDurationYears,
      monthlyRentOverride,
      occupationMonths,
      relocateSurfaceSqm,
      relocateMarketTier,
    },
    hasMinorChildren: childrenActive,
    numberOfChildren: childrenActive
      ? lab.overrides.children_impact!.numberOfChildren
      : undefined,
    custodyType: childrenActive ? lab.overrides.children_impact!.custodyType : undefined,
    postalCode: footprint.postalCode,
    propertySurface: surface,
    ...(marketBuy &&
    marketBuy.postalCode === footprint.postalCode &&
    marketBuy.medianPricePerSqm > 0
      ? {
          zoneMedianPricePerSqm: marketBuy.medianPricePerSqm,
          zoneMinPricePerSqm: marketBuy.minPricePerSqm,
          zoneMaxPricePerSqm: marketBuy.maxPricePerSqm,
          zonePriceSource: marketBuy.source,
        }
      : {}),
    ...(marketRent &&
    marketRent.postalCode === footprint.postalCode &&
    marketRent.medianRentPerSqm > 0
      ? {
          zoneRentMedianPerSqm: marketRent.medianRentPerSqm,
          zoneRentMinPerSqm: marketRent.minRentPerSqm,
          zoneRentMaxPerSqm: marketRent.maxRentPerSqm,
          zoneRentSource: marketRent.source,
        }
      : {}),
    contributionA: contributionsActive
      ? merged.contributionA
      : footprint.completedAt
        ? footprint.contributionA
        : undefined,
    contributionB: contributionsActive
      ? merged.contributionB
      : footprint.completedAt
        ? footprint.contributionB
        : undefined,
    // Mensualité réelle → mode « garder mon crédit » (keep) + charge locative (rent_out).
    monthlyMortgagePayment,
  };
}

export function isFootprintComplete(footprint: FootprintState): boolean {
  const legalOk =
    footprint.cadreJuridiqueDeclared &&
    (footprint.legalStatus === "marriage" ||
      footprint.legalStatus === "pacs" ||
      footprint.legalStatus === "concubinage") &&
    footprint.ownershipShareA > 0 &&
    footprint.ownershipShareB > 0 &&
    footprint.ownershipShareA + footprint.ownershipShareB === 100;

  const base =
    legalOk &&
    footprint.postalCode.length >= 5 &&
    footprint.propertyValue > 0 &&
    footprint.propertySurface > 0 &&
    footprint.mortgageRemaining >= 0 &&
    footprint.purchasePrice >= 0 &&
    footprint.incomeA > 0 &&
    footprint.incomeB > 0;

  if (!base) return false;

  if (footprint.mortgageRemaining > 0) {
    return (
      footprint.monthlyMortgagePayment > 0 &&
      footprint.mortgageRemainingYears >= 1 &&
      footprint.mortgageRemainingYears <= 30
    );
  }

  return true;
}

export function defaultAssumptions(): AssumptionsState {
  const rate = getMortgageRateSnapshot(DEFAULT_MORTGAGE_DURATION_YEARS);
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

/**
 * Active les leviers labo correspondant aux données déjà saisies en Empreinte,
 * avec les mêmes valeurs préremplies.
 */
export function seedLabFromFootprint(
  footprint: FootprintState,
  currentLab: LabState = defaultLabState()
): LabState {
  const enabled = new Set(currentLab.enabledLevers);
  const overrides = { ...currentLab.overrides };

  const hasApports = footprint.contributionA > 0 || footprint.contributionB > 0;
  if (hasApports) {
    enabled.add("initial_contributions");
    overrides.initial_contributions = {
      contributionA: footprint.contributionA,
      contributionB: footprint.contributionB,
    };
  } else {
    enabled.delete("initial_contributions");
    delete overrides.initial_contributions;
  }

  const hasActiveCredit =
    footprint.mortgageRemaining > 0 && footprint.monthlyMortgagePayment > 0;
  if (hasActiveCredit) {
    enabled.add("historical_mortgage_rate");
    overrides.historical_mortgage_rate = {
      monthlyMortgagePayment: footprint.monthlyMortgagePayment,
      ...(footprint.initialMortgageRate > 0
        ? { mortgageRate: footprint.initialMortgageRate }
        : {}),
    };
  } else {
    enabled.delete("historical_mortgage_rate");
    delete overrides.historical_mortgage_rate;
  }

  // Relogement solo : pré-activé dès qu'une surface Empreinte existe (portes keep/sell/sell_rent).
  if (footprint.propertySurface > 0) {
    enabled.add("relocate_housing");
    const existing = overrides.relocate_housing;
    overrides.relocate_housing = {
      surfaceSqm:
        existing?.surfaceSqm && existing.surfaceSqm > 0
          ? existing.surfaceSqm
          : defaultRelocateSurfaceSqm(footprint.propertySurface),
      marketTier: existing?.marketTier ?? "entry",
    };
  } else {
    enabled.delete("relocate_housing");
    delete overrides.relocate_housing;
  }

  return {
    ...currentLab,
    enabledLevers: [...enabled],
    overrides,
  };
}

export function leverRequiresOverride(leverId: LeverId): boolean {
  return leverId !== "children_impact";
}

export function defaultFootprint(): FootprintState {
  return {
    postalCode: "",
    propertyValue: 0,
    propertySurface: 0,
    purchasePrice: 0,
    mortgageRemaining: 0,
    monthlyMortgagePayment: 0,
    mortgageRemainingYears: 0,
    initialMortgagePrincipal: 0,
    initialMortgageDurationYears: 0,
    mortgageStartMonth: 0,
    mortgageStartYear: 0,
    initialMortgageRate: 0,
    mortgageInsuranceRate: DEFAULT_MORTGAGE_INSURANCE_ANNUAL_RATE,
    mortgageInsuranceMonthly: 0,
    incomeA: 0,
    incomeB: 0,
    contributionA: 0,
    contributionB: 0,
    apportsDeclared: false,
    financementDeclared: false,
    legalStatus: "",
    ownershipShareA: 50,
    ownershipShareB: 50,
    cadreJuridiqueDeclared: false,
    completedAt: null,
  };
}
