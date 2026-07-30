import type {
  AtelierEntity,
  DataTier,
  FlowPhase,
  PropertyValueMode,
  QuickEstimateResult,
  SimulationInput,
  SimulationResult,
  UserIntent,
} from "@separation/schemas";

export interface WizardState {
  step: number;
  flowPhase: FlowPhase;
  intent: UserIntent | null;
  dataTier: DataTier;
  quickEstimate: QuickEstimateResult | null;
  atelierEntities: AtelierEntity[];
  propertyValueAdjustment: number;
  propertySurface: number;
  propertyValueMode: PropertyValueMode;
  dvfMedianPricePerSqm: number | null;
  contributionA: number;
  contributionB: number;
  status: SimulationInput["status"] | null;
  marriageRegime: SimulationInput["marriageRegime"];
  marriageDate: string;
  pacsDate: string;
  hasMinorChildren: boolean;
  numberOfChildren: number;
  custodyType: "classic" | "alternate";
  incomeAMonthly: number;
  incomeBMonthly: number;
  monthlyMortgagePayment: number;
  mediationToken: string | null;
  mediationLink: string | null;
  documentProofId: string | null;
  shareToken: string | null;
  urgencyMonths: number | null;
  postalCode: string;
  propertyAddress: string;
  propertyValue: number;
  mortgageRemaining: number;
  shareA: number;
  shareB: number;
  savingsJoint: number;
  savingsA: number;
  savingsB: number;
  personalDebtsA: number;
  personalDebtsB: number;
  selectedScenario: SimulationInput["options"]["scenario"];
  email: string;
  phone: string;
  optInPartnerMatch: boolean;
  tenantId: string;
  discreteMode: boolean;
  wowSeen: boolean;
  lastResult: SimulationResult | null;
  lastInput: SimulationInput | null;
}

export function intentToScenario(intent: UserIntent): SimulationInput["options"]["scenario"] {
  switch (intent) {
    case "keep_home":
      return "keep_a";
    case "walk_away":
      return "keep_b";
    case "amiable_path":
      return "compare_all";
  }
}

export function computeDataTier(
  state: Pick<
    WizardState,
    | "quickEstimate"
    | "incomeAMonthly"
    | "incomeBMonthly"
    | "hasMinorChildren"
    | "numberOfChildren"
    | "custodyType"
    | "propertyValue"
    | "postalCode"
    | "status"
  >,
  readyForScenarios: boolean
): DataTier {
  if (readyForScenarios) return "complete";
  if (state.incomeAMonthly > 0 || state.incomeBMonthly > 0) return "partial";
  if (state.quickEstimate) return "snapshot";
  if (state.status || state.propertyValue > 0) return "partial";
  return "empty";
}

export function buildInitialAtelierEntities(
  state: Pick<WizardState, "propertyValue" | "mortgageRemaining" | "postalCode">
): AtelierEntity[] {
  return [
    {
      id: "logement",
      type: "logement",
      zoneId: "patrimoine",
      label: "Logement",
      complete: state.propertyValue > 0 && state.postalCode.length >= 5,
    },
    {
      id: "credit",
      type: "credit",
      zoneId: "patrimoine",
      label: "Crédit immo",
      complete: true,
    },
  ];
}

export const initialWizardState: WizardState = {
  step: 0,
  flowPhase: "narrative",
  intent: null,
  dataTier: "empty",
  quickEstimate: null,
  atelierEntities: [],
  propertyValueAdjustment: 0,
  propertySurface: 0,
  propertyValueMode: "dvf",
  dvfMedianPricePerSqm: null,
  contributionA: 0,
  contributionB: 0,
  status: null,
  marriageRegime: "communaute_legale",
  marriageDate: "",
  pacsDate: "",
  hasMinorChildren: false,
  numberOfChildren: 0,
  custodyType: "classic",
  incomeAMonthly: 0,
  incomeBMonthly: 0,
  monthlyMortgagePayment: 0,
  mediationToken: null,
  mediationLink: null,
  documentProofId: null,
  shareToken: null,
  urgencyMonths: null,
  postalCode: "",
  propertyAddress: "",
  propertyValue: 0,
  mortgageRemaining: 0,
  shareA: 50,
  shareB: 50,
  savingsJoint: 0,
  savingsA: 0,
  savingsB: 0,
  personalDebtsA: 0,
  personalDebtsB: 0,
  selectedScenario: "compare_all",
  email: "",
  phone: "",
  optInPartnerMatch: false,
  tenantId: "default",
  discreteMode: false,
  wowSeen: false,
  lastResult: null,
  lastInput: null,
};

export function wizardToSimulationInput(state: WizardState): SimulationInput {
  const shareA = state.shareA / 100;
  const shareB = state.shareB / 100;

  const assets: SimulationInput["assets"] = [];

  if (state.propertyValue > 0) {
    assets.push({
      id: "primary-residence",
      type: "real_estate",
      label: state.propertyAddress || "Résidence principale",
      grossValue: { amount: state.propertyValue, currency: "EUR" },
      ownership:
        state.status === "marriage" && state.marriageRegime === "communaute_legale"
          ? { kind: "community" }
          : { kind: "indivision", shares: { A: shareA, B: shareB } },
      isPrimaryResidence: true,
      linkedLiabilityIds: state.mortgageRemaining > 0 ? ["mortgage"] : undefined,
    });
  }

  if (state.savingsJoint > 0) {
    assets.push({
      id: "savings-joint",
      type: "savings",
      label: "Épargne commune",
      grossValue: { amount: state.savingsJoint, currency: "EUR" },
      ownership:
        state.status === "marriage" && state.marriageRegime === "communaute_legale"
          ? { kind: "community" }
          : { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
    });
  }

  if (state.savingsA > 0) {
    assets.push({
      id: "savings-a",
      type: "savings",
      label: "Épargne personne A",
      grossValue: { amount: state.savingsA, currency: "EUR" },
      ownership: { kind: "own", owner: "A" },
    });
  }

  if (state.savingsB > 0) {
    assets.push({
      id: "savings-b",
      type: "savings",
      label: "Épargne personne B",
      grossValue: { amount: state.savingsB, currency: "EUR" },
      ownership: { kind: "own", owner: "B" },
    });
  }

  const liabilities: SimulationInput["liabilities"] = [];

  if (state.mortgageRemaining > 0) {
    liabilities.push({
      id: "mortgage",
      type: "mortgage",
      label: "Crédit immobilier",
      remainingBalance: { amount: state.mortgageRemaining, currency: "EUR" },
      responsibility:
        state.status === "marriage" && state.marriageRegime === "communaute_legale"
          ? { kind: "community" }
          : { kind: "indivision", shares: { A: shareA, B: shareB } },
      linkedAssetId: "primary-residence",
    });
  }

  if (state.personalDebtsA > 0) {
    liabilities.push({
      id: "debt-a",
      type: "consumer_loan",
      label: "Dettes personne A",
      remainingBalance: { amount: state.personalDebtsA, currency: "EUR" },
      responsibility: { kind: "own", owner: "A" },
    });
  }

  if (state.personalDebtsB > 0) {
    liabilities.push({
      id: "debt-b",
      type: "consumer_loan",
      label: "Dettes personne B",
      remainingBalance: { amount: state.personalDebtsB, currency: "EUR" },
      responsibility: { kind: "own", owner: "B" },
    });
  }

  return {
    status: state.status ?? "concubinage",
    marriageRegime:
      state.status === "marriage" ? state.marriageRegime : undefined,
    marriageDate: state.marriageDate || undefined,
    pacsDate: state.pacsDate || undefined,
    persons: [
      {
        id: "A",
        income: state.incomeAMonthly > 0 ? { amount: state.incomeAMonthly, currency: "EUR" } : undefined,
      },
      {
        id: "B",
        income: state.incomeBMonthly > 0 ? { amount: state.incomeBMonthly, currency: "EUR" } : undefined,
      },
    ],
    assets,
    liabilities,
    options: {
      primaryResidenceId: state.propertyValue > 0 ? "primary-residence" : undefined,
      scenario: state.selectedScenario,
    },
    hasMinorChildren: state.hasMinorChildren,
    urgencyMonths: state.urgencyMonths ?? undefined,
    tenantId: state.tenantId,
  };
}
