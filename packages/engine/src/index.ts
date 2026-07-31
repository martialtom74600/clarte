export { runSimulation, getStrategy, computeComplexityScore, computeWarnings } from "./simulator.js";
export {
  computeSoulteCore,
  resolveEffectiveShares,
  usesRecompenseModel,
  droitDePartageRate,
  DROIT_PARTAGE_RATE_MARRIAGE_PACS,
  DROIT_PARTAGE_RATE_CONCUBINAGE,
  DEFAULT_EMOLUMENTS_RATE_ON_NET,
} from "./soulte-core.js";
export {
  computeSaleProceeds,
  DEFAULT_AGENCY_FEES_RATE,
  DEFAULT_DIAGNOSTICS_FLAT_EUR,
  DEFAULT_SELLING_COSTS_RATE,
} from "./sale-proceeds.js";
export type { SaleProceedsBreakdown, RelocateSnapshot } from "./sale-proceeds.js";
export { BANK_KEEP_LOAN_DISCLAIMER } from "./simulator.js";
export type { ContributionMode } from "./soulte-core.js";
export { runQuickEstimate } from "./quick-estimate.js";
export {
  computeAffordability,
  computeNewLifeCap,
  buildZoneMarketSnapshot,
  resolveZoneDepartments,
  computeMaxBorrowing,
  rentPerSqm,
} from "./affordability.js";
export { compileDoorVerdicts, RENT_GREEN_THRESHOLD, RENT_CHARGES_MONTHLY } from "./door-verdicts.js";
export { getMortgageRateSnapshot } from "./mortgage-rates.js";
export {
  estimateChildSupport,
  analyzePatrimonyImbalance,
  compareResolutionPaths,
  CEEE_MINIMUM_VITAL,
  SUPPORT_RATES,
} from "./support.js";
export type {
  ChildSupportInput,
  ChildSupportResult,
  CustodyType,
  PatrimonyImbalance,
  ResolutionComparison,
} from "./support.js";
export { computePostSeparationCashflow } from "./cashflow.js";
export type { CashflowInput, CashflowResult, PersonCashflow } from "./cashflow.js";
export { compareMediationInputs } from "./mediation.js";
export type { MediationComparison, MediationFieldDiff } from "./mediation.js";
export {
  eur,
  round,
  addMoney,
  subtractMoney,
  multiplyMoney,
  getNetAssetValue,
  getPersonShareOfAsset,
  normalizePatrimony,
  estimateMonthlyPayment,
  getPrimaryResidence,
  RULE_PACK_VERSION,
  DEFAULT_DISCLAIMERS,
} from "./utils.js";
