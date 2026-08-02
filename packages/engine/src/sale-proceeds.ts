import type {
  AffordabilityResult,
  AffordabilityVerdict,
  Asset,
  Liability,
  Money,
  PersonId,
  SimulationInput,
} from "@separation/schemas";
import { computeAffordability } from "./affordability.js";
import { estimateCapitalGains } from "./capital-gains.js";
import { getMortgageRateSnapshot } from "./mortgage-rates.js";
import { resolveRelocateHousing } from "./relocate-housing.js";
import { eur, getNetAssetValue, getShareForPerson, round } from "./utils.js";

/** Commission d'agence / mise en vente — ordre de grandeur ~5 % du prix brut. */
export const DEFAULT_AGENCY_FEES_RATE = 0.05;

/**
 * Forfait diagnostics obligatoires (DPE, amiante, plomb, électricité, gaz, ERP…).
 * Ordre de grandeur métropole ; pas un devis.
 */
export const DEFAULT_DIAGNOSTICS_FLAT_EUR = 1800;

/** @deprecated Alias — préférer DEFAULT_AGENCY_FEES_RATE + diagnostics. */
export const DEFAULT_SELLING_COSTS_RATE = DEFAULT_AGENCY_FEES_RATE;

export interface RelocateSnapshot {
  targetPrice: Money;
  surfaceSqm: number;
  affordability: AffordabilityResult;
  verdict: AffordabilityVerdict;
}

export interface SaleProceedsBreakdown {
  grossValue: Money;
  agencyFees: Money;
  diagnosticsFees: Money;
  /** Agence + diagnostics. */
  sellingCosts: Money;
  mortgageRemaining: Money;
  /** Brut − agence − diagnostics − CRD (peut être négatif). */
  saleNetProceeds: Money;
  shareA: number;
  shareB: number;
  netProceedsByPerson: Record<PersonId, Money>;
  negativeEquity: boolean;
  /** CGI art. 150 U — exonération résidence principale. */
  primaryResidenceExempt: boolean;
  /** Estimation plus-value (0 si RP exonérée ; sinon stub tant que prix d'acquisition absent). */
  capitalGainsEstimate: Money;
  capitalGainsNote: string;
  relocateTarget: Money;
  relocateSurfaceSqm: number;
  relocateByPerson: Record<PersonId, RelocateSnapshot>;
}

function mortgageBalance(asset: Asset, liabilities: Liability[]): number {
  return liabilities
    .filter(
      (l) =>
        l.type === "mortgage" &&
        (asset.linkedLiabilityIds?.includes(l.id) || l.linkedAssetId === asset.id)
    )
    .reduce((sum, l) => sum + l.remainingBalance.amount, 0);
}

function incomeFor(input: SimulationInput, person: PersonId): number {
  return input.persons.find((p) => p.id === person)?.income?.amount ?? 0;
}

/**
 * Net vendeur bilatéral après frais d'agence + diagnostics + CRD,
 * avec structure CGI 150 U (exonération RP) et test de relogement zone A/B.
 */
export function computeSaleProceeds(
  asset: Asset,
  liabilities: Liability[],
  input: SimulationInput
): SaleProceedsBreakdown {
  const agencyRate = input.options.sellingCostsRate ?? DEFAULT_AGENCY_FEES_RATE;
  const diagnosticsFlat =
    input.options.diagnosticsFlatFee ?? DEFAULT_DIAGNOSTICS_FLAT_EUR;

  const gross = asset.grossValue.amount;
  const agencyFees = eur(round(gross * agencyRate));
  const diagnosticsFees = eur(Math.max(0, diagnosticsFlat));
  const sellingCosts = eur(agencyFees.amount + diagnosticsFees.amount);
  const mortgageRemainingAmt = mortgageBalance(asset, liabilities);
  const equityBeforeCosts = getNetAssetValue(asset, liabilities);
  const saleNetProceeds = eur(equityBeforeCosts.amount - sellingCosts.amount);

  const cg = estimateCapitalGains(asset, gross);
  // Impôt PV déduit du net vendeur (0 si RP exonérée ou prix d'acquisition absent).
  const afterTaxNet = eur(saleNetProceeds.amount - cg.totalTax.amount);

  const shareA = getShareForPerson(asset.ownership, "A");
  const shareB = getShareForPerson(asset.ownership, "B");
  const netProceedsByPerson: Record<PersonId, Money> = {
    A: eur(afterTaxNet.amount * shareA),
    B: eur(afterTaxNet.amount * shareB),
  };

  const housing = resolveRelocateHousing(input);
  const relocateTarget = housing.targetPrice;
  const rateSnapshot = getMortgageRateSnapshot(input.options.mortgageDurationYears ?? 20);

  const buildRelocate = (person: PersonId): RelocateSnapshot => {
    const affordability = computeAffordability({
      incomeMonthly: incomeFor(input, person),
      liquidCapital: Math.max(0, netProceedsByPerson[person].amount),
      targetPropertyPrice: relocateTarget.amount,
      durationYears: rateSnapshot.durationYears,
    });
    return {
      targetPrice: relocateTarget,
      surfaceSqm: housing.surfaceSqm,
      affordability,
      verdict: affordability.verdict,
    };
  };

  return {
    grossValue: eur(gross),
    agencyFees,
    diagnosticsFees,
    sellingCosts,
    mortgageRemaining: eur(mortgageRemainingAmt),
    saleNetProceeds: afterTaxNet,
    shareA,
    shareB,
    netProceedsByPerson,
    negativeEquity: afterTaxNet.amount < 0,
    primaryResidenceExempt: asset.isPrimaryResidence === true,
    capitalGainsEstimate: cg.totalTax,
    capitalGainsNote: cg.note,
    relocateTarget,
    relocateSurfaceSqm: housing.surfaceSqm,
    relocateByPerson: {
      A: buildRelocate("A"),
      B: buildRelocate("B"),
    },
  };
}
