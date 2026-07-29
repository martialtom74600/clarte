export type PersonId = "A" | "B";

export type RelationshipStatus = "concubinage" | "pacs" | "marriage";

export type MarriageRegime =
  | "communaute_legale"
  | "separation_biens"
  | "communaute_universelle";

export type AssetType =
  | "real_estate"
  | "savings"
  | "investment"
  | "vehicle"
  | "other";

export type LiabilityType = "mortgage" | "consumer_loan" | "other";

export type ScenarioType = "keep_a" | "keep_b" | "sell" | "compare_all";

export interface Money {
  amount: number;
  currency: "EUR";
}

export interface Person {
  id: PersonId;
  name?: string;
  income?: Money;
}

export type OwnershipRule =
  | { kind: "indivision"; shares: Record<PersonId, number> }
  | { kind: "own"; owner: PersonId }
  | { kind: "community" }
  | {
      kind: "mixed";
      communityShare: number;
      ownerShare: Record<PersonId, number>;
    };

export type ResponsibilityRule =
  | { kind: "indivision"; shares: Record<PersonId, number> }
  | { kind: "own"; owner: PersonId }
  | { kind: "community" };

export interface Asset {
  id: string;
  type: AssetType;
  label: string;
  grossValue: Money;
  ownership: OwnershipRule;
  acquisitionDate?: string;
  linkedLiabilityIds?: string[];
  isPrimaryResidence?: boolean;
}

export interface Liability {
  id: string;
  type: LiabilityType;
  label?: string;
  remainingBalance: Money;
  responsibility: ResponsibilityRule;
  linkedAssetId?: string;
}

export interface SimulationOptions {
  primaryResidenceId?: string;
  scenario: ScenarioType;
  notaryFeesRate?: number;
  mortgageRate?: number;
  mortgageDurationYears?: number;
}

export interface SimulationInput {
  status: RelationshipStatus;
  marriageRegime?: MarriageRegime;
  marriageDate?: string;
  pacsDate?: string;
  persons: [Person, Person];
  assets: Asset[];
  liabilities: Liability[];
  options: SimulationOptions;
  hasMinorChildren?: boolean;
  urgencyMonths?: number;
  tenantId?: string;
}

export interface SoulteResult {
  payer: PersonId;
  receiver: PersonId;
  amount: Money;
  assetId: string;
  assetLabel: string;
  netAssetValue: Money;
  notaryFeesEstimate?: Money;
  totalCashNeeded?: Money;
}

export interface ScenarioComparison {
  scenario: ScenarioType;
  label: string;
  netWorthByPerson: Record<PersonId, Money>;
  soulte?: SoulteResult;
  monthlyPaymentEstimate?: Money;
  cashNeeded?: Money;
  description: string;
}

export interface LegalWarning {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
}

export interface SimulationResult {
  netWorthByPerson: Record<PersonId, Money>;
  communityMass?: Money;
  soulte?: SoulteResult;
  scenarios: ScenarioComparison[];
  complexityScore: number;
  warnings: LegalWarning[];
  disclaimers: string[];
  rulePackVersion: string;
}

export interface LeadQualification {
  email: string;
  simulationId?: string;
  urgencyMonths?: number;
  hasMinorChildren?: boolean;
  propertyValue?: number;
  scenarioPreference?: ScenarioType;
  optInPartnerMatch?: boolean;
  tenantId?: string;
}

export interface LeadScore {
  score: number;
  tier: "cold" | "warm" | "hot";
  recommendedPartners: ("notaire" | "courtier" | "agence")[];
  qualifiesForCpl: boolean;
}

export interface TenantConfig {
  id: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  webhookUrl?: string;
  stripeCustomerId?: string;
}

export * from "./zod.js";
