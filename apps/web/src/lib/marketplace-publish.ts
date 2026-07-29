import { buildMarketplaceLead } from "@separation/marketplace";
import type { SimulationInput, SimulationResult } from "@separation/schemas";
import { scoreLead } from "@separation/lead-scoring";
import { createMarketplaceLead } from "@/lib/supabase";

export interface PublishMarketplaceInput {
  email: string;
  phone: string;
  postalCode: string;
  proofId?: string;
  shareToken: string;
  simulation: SimulationInput;
  result: SimulationResult;
  urgencyMonths?: number;
  hasMinorChildren?: boolean;
  simulationId?: string;
}

export type PublishMarketplaceResult =
  | { listed: true; marketplaceLeadId: string }
  | { listed: false; reason: "not_sellable" | "no_opt_in"; message?: string };

export async function publishLeadToMarketplace(
  input: PublishMarketplaceInput
): Promise<PublishMarketplaceResult> {
  const leadScore = scoreLead(
    {
      email: input.email,
      optInPartnerMatch: true,
      urgencyMonths: input.urgencyMonths,
      hasMinorChildren: input.hasMinorChildren,
      scenarioPreference: input.simulation.options.scenario,
    },
    input.simulation,
    input.result
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const marketplaceInput = buildMarketplaceLead({
    email: input.email,
    phone: input.phone,
    proofId: input.proofId,
    pdfUrl: input.proofId ? `${appUrl}/api/pdf` : null,
    shareToken: input.shareToken,
    postalCode: input.postalCode,
    simulation: input.simulation,
    result: input.result,
    leadScore,
    simulationId: input.simulationId,
    optInPartnerMatch: true,
  });

  if (!marketplaceInput) {
    return {
      listed: false,
      reason: "not_sellable",
      message: "Lead non publiable : qualification ou téléphone manquant.",
    };
  }

  const saved = await createMarketplaceLead(marketplaceInput);
  return { listed: true, marketplaceLeadId: saved.id };
}
