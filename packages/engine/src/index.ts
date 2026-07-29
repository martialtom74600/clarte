export { runSimulation, getStrategy, computeComplexityScore, computeWarnings } from "./simulator.js";
export {
  estimateChildSupport,
  analyzePatrimonyImbalance,
  compareResolutionPaths,
} from "./support.js";
export type { ChildSupportInput, ChildSupportResult, CustodyType, PatrimonyImbalance, ResolutionComparison } from "./support.js";
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
