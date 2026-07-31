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

export type ScenarioType = "keep_a" | "keep_b" | "sell" | "rent_out" | "compare_all";

export type UserIntent = "keep_home" | "walk_away" | "amiable_path";

export type FlowPhase = "narrative" | "scenarios" | "secure";

export type DataTier = "empty" | "snapshot" | "partial" | "complete";

export type AtelierEntityType =
  | "logement"
  | "credit"
  | "revenus"
  | "epargne"
  | "enfants"
  | "dettes"
  | "cadre";

export interface AtelierEntity {
  id: string;
  type: AtelierEntityType;
  zoneId: string;
  label: string;
  complete: boolean;
}

export type PropertyValueMode = "dvf" | "manual";

export interface QuickEstimateInput {
  status: RelationshipStatus;
  marriageRegime?: MarriageRegime;
  intent: UserIntent;
  propertyValue: number;
  mortgageRemaining: number;
  shareA?: number;
  shareB?: number;
  propertyValueVariance?: number;
  notaryFeesRate?: number;
  postalCode?: string;
  propertySurface?: number;
  propertyValueMode?: PropertyValueMode;
}

export interface QuickEstimateAssumption {
  code: string;
  label: string;
}

export type QuickEstimateConfidence = "low" | "medium" | "high";

export interface QuickEstimateResult {
  min: Money;
  max: Money;
  midpoint: Money;
  confidence: QuickEstimateConfidence;
  assumptions: QuickEstimateAssumption[];
  soulte?: SoulteResult;
  netEquity: Money;
}

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
  /** Override du taux d'émoluments sur l'actif net (défaut moteur ~1,5 %). Plus un % de soulte. */
  notaryFeesRate?: number;
  mortgageRate?: number;
  mortgageDurationYears?: number;
  /** Override loyer mensuel brut pour le scénario rent_out (levier labo). */
  monthlyRentOverride?: number;
  /** Taux frais d'agence / mise en vente sur le prix brut (défaut moteur ~5 %). */
  sellingCostsRate?: number;
  /** Forfait diagnostics obligatoires (€) — défaut moteur ~1 800 €. */
  diagnosticsFlatFee?: number;
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
  numberOfChildren?: number;
  custodyType?: "classic" | "alternate" | "reduced";
  urgencyMonths?: number;
  tenantId?: string;
  /** Empreinte / labo — localisation et surface pour rent_out dynamique. */
  postalCode?: string;
  propertySurface?: number;
  /** Apports initiaux : récompense en communauté, ratio/créance en indivision. */
  contributionA?: number;
  contributionB?: number;
  /** Mensualité réelle du prêt existant (levier taux historique / désolidarisation). */
  monthlyMortgagePayment?: number;
}

/** Identifiant des 4 portes du tableau de bord (Strate 2). */
export type DoorId = "keep_a" | "keep_b" | "sell" | "rent_out";

export interface DoorVerdict {
  doorId: DoorId;
  verdict: AffordabilityVerdict;
  label: string;
  headline: string;
  detail: string;
  monthlyImpact?: Money;
}

export type DoorVerdictMap = Record<DoorId, DoorVerdict>;

export type SeparationStratum = "empreinte" | "portes" | "laboratoire";

export type LeverId =
  | "initial_contributions"
  | "historical_mortgage_rate"
  | "children_impact"
  | "legal_status"
  | "ownership_shares"
  | "custom_rent"
  | "savings";

export interface SoulteResult {
  payer: PersonId;
  receiver: PersonId;
  amount: Money;
  assetId: string;
  assetLabel: string;
  netAssetValue: Money;
  /** Total frais d'acte (droit de partage + émoluments / CSI / débours). */
  notaryFeesEstimate?: Money;
  /** Soulte + frais d'acte (sortie de cash hors refinancement du CRD). */
  totalCashNeeded?: Money;
  /** CGI art. 746 — 1,10 % (mariage/PACS) ou 2,50 % (concubinage) sur l'actif net. */
  droitDePartage?: Money;
  /** Émoluments notaire + CSI + débours (estimation). */
  emolumentsEstimate?: Money;
  /** Package de refinancement bancaire : CRD + soulte + frais. */
  refinanceAmount?: Money;
  /** Récompenses / créances d'apport retenues (communauté). */
  recompenseA?: Money;
  recompenseB?: Money;
  /** True si l'actif net du bien est négatif (CRD > valeur). */
  negativeEquity?: boolean;
  /** Dette résiduelle à partager quand l'actif net est négatif. */
  residualDebt?: Money;
}

export type KeepFinancingMode = "full_refinance" | "keep_existing_loan";

export type AffordabilityVerdict = "green" | "orange" | "red";

export interface ScenarioComparison {
  scenario: ScenarioType;
  label: string;
  netWorthByPerson: Record<PersonId, Money>;
  soulte?: SoulteResult;
  /** Mensualité totale à la charge du gardien (nouveau prêt ± crédit conservé). */
  monthlyPaymentEstimate?: Money;
  cashNeeded?: Money;
  monthlyNetCashflow?: Record<PersonId, Money>;
  description: string;
  /** Mode de financement du scénario keep_* (levier « garder mon crédit »). */
  keepFinancingMode?: KeepFinancingMode;
  /** Mensualité du prêt actuel conservé (désolidarisation). */
  keptMortgageMonthly?: Money;
  /** Capital du nouveau prêt (rachat + frais, ou CRD + rachat + frais). */
  newLoanAmount?: Money;
  /** Mensualité du seul nouveau prêt. */
  newLoanMonthly?: Money;
  /** Frais d'agence estimés (~5 % du brut). */
  agencyFeesEstimate?: Money;
  /** Forfait diagnostics obligatoires. */
  diagnosticsEstimate?: Money;
  /** Total frais de sortie (agence + diagnostics). */
  sellingCostsEstimate?: Money;
  /** Produit net de vente après frais de sortie et remboursement du crédit. */
  saleNetProceeds?: Money;
  /** Quote-part nette bilatérale après vente (Vous / Autre). */
  saleProceedsByPerson?: Record<PersonId, Money>;
  /** True si produit net ou equity du bien est négatif. */
  negativeEquity?: boolean;
  /** Avertissement banque (désolidarisation / keep_existing_loan). */
  bankDisclaimer?: string;
  /** CGI 150 U — exonération résidence principale. */
  primaryResidenceExempt?: boolean;
  /** Plus-value estimée (0 si RP exonérée). */
  capitalGainsEstimate?: Money;
  capitalGainsNote?: string;
  /** Prix cible de relogement dans la zone. */
  relocateTarget?: Money;
  /** Verdict de relogement par personne (même zone). */
  relocateVerdictByPerson?: Record<PersonId, AffordabilityVerdict>;
}

export interface MortgageRateSnapshot {
  annualRate: number;
  durationYears: number;
  asOf: string;
  source: string;
}

export interface AffordabilityResult {
  verdict: AffordabilityVerdict;
  targetPropertyPrice: Money;
  availableBudget: Money;
  maxBorrowing: Money;
  gap: Money;
  monthlyPayment: Money;
  effortRatio: number;
  maxEffortRatio: number;
  label: string;
  detail: string;
}

/** Porte de trajectoire — même identifiants que DoorId (unifié moteur / web). */
export interface LifePathDoor {
  id: DoorId;
  label: string;
  description: string;
  verdict: AffordabilityVerdict;
  headline: string;
  detail: string;
  monthlyImpact?: Money;
}

export interface ZoneMarketSnapshot {
  postalCode: string;
  radiusKm: number;
  departments: string[];
  medianPricePerSqm: Money;
  minPricePerSqm: Money;
  maxPricePerSqm: Money;
  surfaceSqm: number;
  source: string;
  disclaimer: string;
}

export interface NewLifeCapInput {
  postalCode: string;
  propertyValue: number;
  propertySurface: number;
  mortgageRemaining: number;
  monthlyMortgagePayment: number;
  contributionA: number;
  contributionB: number;
  incomeAMonthly: number;
  incomeBMonthly: number;
  netWorthA: number;
  netWorthB: number;
  intent: UserIntent;
  soulteAmount?: number;
  soultePayer?: PersonId;
  zoneMedianPricePerSqm?: number;
  zoneMinPricePerSqm?: number;
  zoneMaxPricePerSqm?: number;
  zoneDepartments?: string[];
}

export interface NewLifeCapResult {
  zone: ZoneMarketSnapshot;
  mortgageRate: MortgageRateSnapshot;
  equityNet: Money;
  contributionsTotal: Money;
  contributionsByPerson: Record<PersonId, Money>;
  netDepartureCapital: Record<PersonId, Money>;
  doors: LifePathDoor[];
  recommendedDoorId: DoorId;
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
export * from "./narrative-form.js";
