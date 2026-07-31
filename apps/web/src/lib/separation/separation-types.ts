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
  /** Valeur actuelle estimée du bien. */
  propertyValue: number;
  /** Surface habitable (m²) — loyer zone, DVF, relogement. */
  propertySurface: number;
  /** Prix d'achat à l'époque (0 = inconnu). */
  purchasePrice: number;
  mortgageRemaining: number;
  /** Mensualité totale du crédit en cours (capital + intérêts + assurance, charge HCSF). */
  monthlyMortgagePayment: number;
  /** Années restantes sur le crédit (durée du refinancement indicatif). */
  mortgageRemainingYears: number;
  /** Capital emprunté initial (€) — mode amortissement empreinte. */
  initialMortgagePrincipal: number;
  /** Durée initiale du prêt (années). */
  initialMortgageDurationYears: number;
  /** Mois de souscription (1–12, 0 = inconnu). */
  mortgageStartMonth: number;
  /** Année de souscription (0 = inconnu). */
  mortgageStartYear: number;
  /** Taux d'intérêt annuel hors assurance à la souscription (décimal, ex. 0.012). */
  initialMortgageRate: number;
  /** Taux d'assurance annuel sur capital initial (décimal, défaut 0,0034). */
  mortgageInsuranceRate: number;
  /** Coût mensuel d'assurance fixe (€) — prime sur le taux si > 0. */
  mortgageInsuranceMonthly: number;
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
