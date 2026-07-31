import type {
  DoorId,
  DoorVerdictMap,
  LeverId,
  MarriageRegime,
  RelationshipStatus,
  SeparationStratum,
  SimulationInput,
  SimulationResult,
} from "@separation/schemas";

export interface FootprintState {
  postalCode: string;
  propertyValue: number;
  mortgageRemaining: number;
  incomeA: number;
  incomeB: number;
  completedAt: string | null;
}

export interface AssumptionsState {
  status: RelationshipStatus;
  shareA: number;
  shareB: number;
  marriageRegime: MarriageRegime;
  mortgageRate: number;
  mortgageDurationYears: number;
  hasMinorChildren: boolean;
  numberOfChildren: number;
  custodyType: "classic" | "alternate";
  contributionA: number;
  contributionB: number;
  propertySurface: number;
  monthlyMortgagePayment: number;
  savingsA: number;
  savingsB: number;
}

export interface LeverOverrides {
  initial_contributions?: { contributionA: number; contributionB: number };
  historical_mortgage_rate?: { monthlyMortgagePayment: number; mortgageRate?: number };
  children_impact?: {
    hasMinorChildren: boolean;
    numberOfChildren: number;
    custodyType: "classic" | "alternate";
  };
  legal_status?: { status: RelationshipStatus; marriageRegime?: MarriageRegime };
  ownership_shares?: { shareA: number; shareB: number };
  custom_rent?: { monthlyRentOverride: number };
  savings?: { savingsA: number; savingsB: number };
  /** Mois d'occupation exclusive avant signature (indemnité = loyer/2 × mois). */
  occupation_indemnity?: { occupationMonths: number };
}

export interface LabState {
  activeDoor: DoorId | null;
  enabledLevers: LeverId[];
  overrides: LeverOverrides;
}

export interface DerivedState {
  lastInput: SimulationInput | null;
  lastResult: SimulationResult | null;
  doorVerdicts: DoorVerdictMap | null;
  computedAt: number | null;
}

export interface SeparationState {
  stratum: SeparationStratum;
  footprint: FootprintState;
  assumptions: AssumptionsState;
  lab: LabState;
  derived: DerivedState;
  discreteMode: boolean;
}

export type FootprintField = keyof Omit<FootprintState, "completedAt">;
