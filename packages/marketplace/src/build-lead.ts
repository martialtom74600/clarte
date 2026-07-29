import type { SimulationInput, SimulationResult } from "@separation/schemas";
import type { LeadScore } from "@separation/schemas";
import type { CreateMarketplaceLeadInput, PartnerType } from "./types.js";
import { buildLeadContact, buildLeadPreview, isLeadSellable } from "./preview.js";
import { getCreditPrice } from "./pricing.js";

export interface MarketplaceLeadSource {
  email: string;
  phone?: string | null;
  proofId?: string | null;
  pdfUrl?: string | null;
  shareToken?: string | null;
  postalCode: string;
  simulation: SimulationInput;
  result: SimulationResult;
  leadScore: LeadScore;
  simulationId?: string;
  brandId?: string;
  optInPartnerMatch: boolean;
}

export function shouldListOnMarketplace(source: MarketplaceLeadSource): boolean {
  if (!source.optInPartnerMatch) return false;
  if (!source.leadScore.qualifiesForCpl) return false;
  const contact = buildLeadContact({
    email: source.email,
    phone: source.phone,
    simulationSummary: {},
  });
  return isLeadSellable(contact);
}

export function buildMarketplaceLead(
  source: MarketplaceLeadSource
): CreateMarketplaceLeadInput | null {
  if (!shouldListOnMarketplace(source)) return null;

  const propertyValue = source.simulation.assets
    .filter((a) => a.type === "real_estate")
    .reduce((s, a) => s + a.grossValue.amount, 0);

  const hasPhone = Boolean(source.phone?.trim());
  const creditPrice = getCreditPrice(source.leadScore.tier, hasPhone);

  const preview = buildLeadPreview({
    postalCode: source.postalCode,
    complexityScore: source.result.complexityScore,
    tier: source.leadScore.tier,
    hasRealEstate: propertyValue > 0,
    propertyValue,
    scenario: source.simulation.options.scenario,
    statusRelationship: source.simulation.status,
    marriageRegime: source.simulation.marriageRegime,
    hasMinorChildren: source.simulation.hasMinorChildren ?? false,
    urgencyMonths: source.simulation.urgencyMonths,
    recommendedFor: source.leadScore.recommendedPartners as PartnerType[],
    hasPhone,
    creditPrice,
  });

  const contact = buildLeadContact({
    email: source.email,
    phone: source.phone,
    proofId: source.proofId,
    pdfUrl: source.pdfUrl,
    shareToken: source.shareToken,
    simulationSummary: {
      status: source.simulation.status,
      marriageRegime: source.simulation.marriageRegime,
      complexityScore: source.result.complexityScore,
      netWorthA: source.result.netWorthByPerson.A.amount,
      netWorthB: source.result.netWorthByPerson.B.amount,
      soulteAmount: source.result.soulte?.amount.amount,
      scenario: source.simulation.options.scenario,
      urgencyMonths: source.simulation.urgencyMonths,
      hasMinorChildren: source.simulation.hasMinorChildren,
    },
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  return {
    brandId: source.brandId ?? source.simulation.tenantId ?? "default",
    simulationId: source.simulationId,
    preview,
    contact,
    creditPrice,
    expiresAt: expiresAt.toISOString(),
  };
}
