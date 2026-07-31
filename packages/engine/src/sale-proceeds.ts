import type {
  AffordabilityResult,
  AffordabilityVerdict,
  Asset,
  Liability,
  Money,
  PersonId,
  SimulationInput,
} from "@separation/schemas";
import { buildZoneMarketSnapshot, computeAffordability } from "./affordability.js";
import { getMortgageRateSnapshot } from "./mortgage-rates.js";
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

  const shareA = getShareForPerson(asset.ownership, "A");
  const shareB = getShareForPerson(asset.ownership, "B");
  const netProceedsByPerson: Record<PersonId, Money> = {
    A: eur(saleNetProceeds.amount * shareA),
    B: eur(saleNetProceeds.amount * shareB),
  };

  const primaryResidenceExempt = asset.isPrimaryResidence === true;
  const capitalGainsEstimate = eur(0);
  const capitalGainsNote = primaryResidenceExempt
    ? "Plus-value : exonération résidence principale (CGI art. 150 U) — indicative."
    : "Plus-value : bien hors résidence principale — prix d'acquisition requis pour estimer l'impôt (CGI art. 150 U). Non chiffrée ici.";

  const postalCode = input.postalCode ?? "75000";
  const surface = input.propertySurface ?? 65;
  const relocateSurface = Math.max(45, surface - 15);
  const zone = buildZoneMarketSnapshot(postalCode, surface);
  const relocateTarget = eur(round(zone.minPricePerSqm.amount * relocateSurface));
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
      surfaceSqm: relocateSurface,
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
    saleNetProceeds,
    shareA,
    shareB,
    netProceedsByPerson,
    negativeEquity: saleNetProceeds.amount < 0,
    primaryResidenceExempt,
    capitalGainsEstimate,
    capitalGainsNote,
    relocateTarget,
    relocateSurfaceSqm: relocateSurface,
    relocateByPerson: {
      A: buildRelocate("A"),
      B: buildRelocate("B"),
    },
  };
}
