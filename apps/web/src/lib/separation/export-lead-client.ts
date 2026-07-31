import type { DoorId, SimulationInput, SimulationResult } from "@separation/schemas";
import { compileSimulationInput } from "./compile-simulation-input";
import type { AssumptionsState, FootprintState, LabState } from "./separation-types";

export interface SubmitSeparationLeadInput {
  fullName: string;
  email: string;
  phone: string;
  optInPartnerMatch: boolean;
  footprint: FootprintState;
  assumptions: AssumptionsState;
  lab: LabState;
  result: SimulationResult;
}

export interface SubmitSeparationLeadResult {
  success: boolean;
  shareToken?: string;
  shareUrl?: string;
  marketplaceListed?: boolean;
  marketplaceMessage?: string;
  error?: string;
}

/** Simulation moteur avec le scénario actif (porte laboratoire). */
export function buildLeadSimulationInput(params: {
  footprint: FootprintState;
  assumptions: AssumptionsState;
  lab: LabState;
}): SimulationInput | null {
  if (!params.lab.activeDoor) return null;
  const input = compileSimulationInput(params);
  return {
    ...input,
    options: {
      ...input.options,
      scenario: params.lab.activeDoor as DoorId,
    },
  };
}

export async function submitSeparationLead(
  params: SubmitSeparationLeadInput
): Promise<SubmitSeparationLeadResult> {
  const simulation = buildLeadSimulationInput({
    footprint: params.footprint,
    assumptions: params.assumptions,
    lab: params.lab,
  });

  if (!simulation) {
    return { success: false, error: "Scénario actif manquant." };
  }

  const response = await fetch("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: params.fullName.trim(),
      email: params.email.trim(),
      phone: params.phone.trim(),
      postalCode: params.footprint.postalCode,
      simulation,
      result: params.result,
      optInPartnerMatch: params.optInPartnerMatch,
      scenarioPreference: params.lab.activeDoor,
      hasMinorChildren: params.assumptions.hasMinorChildren,
    }),
  });

  const data = (await response.json()) as {
    success?: boolean;
    shareToken?: string;
    shareUrl?: string;
    marketplaceListed?: boolean;
    marketplaceMessage?: string;
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    return {
      success: false,
      error: data.message ?? data.error ?? "Transmission impossible pour le moment.",
    };
  }

  return {
    success: true,
    shareToken: data.shareToken,
    shareUrl: data.shareUrl,
    marketplaceListed: data.marketplaceListed,
    marketplaceMessage: data.marketplaceMessage,
  };
}
