import type {
  DoorId,
  DoorVerdictMap,
  LeverId,
  MarriageRegime,
  RelocateMarketTier,
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
  /** Apport personnel à l'achat (€, 0 = aucun ou inconnu). */
  contributionA: number;
  contributionB: number;
  /** Apports enregistrés (étape 4 validée). */
  apportsDeclared: boolean;
  /** Financement enregistré (étape 5 validée, y compris sans crédit). */
  financementDeclared: boolean;
  /** Statut du couple — renseigné à l'étape Cadre juridique. */
  legalStatus: RelationshipStatus | "";
  /** Quote-part personne A (0–100). */
  ownershipShareA: number;
  /** Quote-part personne B (0–100). */
  ownershipShareB: number;
  /** Cadre juridique enregistré (étape 3 validée). */
  cadreJuridiqueDeclared: boolean;
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
  /** Surface + gamme marché pour le relogement solo. */
  relocate_housing?: { surfaceSqm: number; marketTier: RelocateMarketTier };
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

/** Marché achat zone (DVF) — injecté async côté web, consommé sync par le moteur. */
export interface MarketBuyState {
  postalCode: string;
  medianPricePerSqm: number;
  minPricePerSqm: number;
  maxPricePerSqm: number;
  source: "dvf" | "dvf_dept" | "fallback";
  transactionCount: number;
  asOfYear?: number;
  fetchedAt: number;
}

/** Marché locatif zone (Carte des loyers ANIL) — injecté async, consommé sync. */
export interface MarketRentState {
  postalCode: string;
  communeCode: string | null;
  communeName: string | null;
  medianRentPerSqm: number;
  minRentPerSqm: number;
  maxRentPerSqm: number;
  source: "carte_loyers" | "fallback";
  asOfYear?: number;
  fetchedAt: number;
}

export interface SeparationState {
  stratum: SeparationStratum;
  footprint: FootprintState;
  assumptions: AssumptionsState;
  lab: LabState;
  /** Snapshot DVF / fallback pour le CP de l'empreinte. */
  marketBuy: MarketBuyState | null;
  /** Snapshot Carte des loyers / fallback pour le CP de l'empreinte. */
  marketRent: MarketRentState | null;
  derived: DerivedState;
  discreteMode: boolean;
}

export type FootprintField = keyof Omit<FootprintState, "completedAt">;
