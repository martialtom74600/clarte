import { leadQualificationSchema, simulationInputSchema } from "@separation/schemas";
import type { SimulationInput, SimulationResult } from "@separation/schemas";
import { publishLeadToMarketplace } from "@/lib/marketplace-publish";
import { verifyLeadPublishSession } from "@/lib/lead-session";
import { NextResponse } from "next/server";
import { z } from "zod";

const publishMarketplaceSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(8),
  postalCode: z.string().min(4),
  shareToken: z.string().min(8),
  proofId: z.string().optional(),
  simulation: z.custom<SimulationInput>(),
  result: z.custom<SimulationResult>(),
  urgencyMonths: z.number().optional(),
  hasMinorChildren: z.boolean().optional(),
  optInPartnerMatch: z.literal(true),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = publishMarketplaceSchema.parse(body);

    simulationInputSchema.parse(parsed.simulation);
    leadQualificationSchema.parse({
      email: parsed.email,
      optInPartnerMatch: true,
      urgencyMonths: parsed.urgencyMonths,
      hasMinorChildren: parsed.hasMinorChildren,
      scenarioPreference: parsed.simulation.options.scenario,
    });

    const session = await verifyLeadPublishSession(parsed.email, parsed.shareToken);
    if (!session) {
      return NextResponse.json(
        { error: "INVALID_SESSION", message: "Session de simulation invalide ou expirée." },
        { status: 403 }
      );
    }

    const outcome = await publishLeadToMarketplace({
      email: parsed.email,
      phone: parsed.phone.trim(),
      postalCode: parsed.postalCode,
      proofId: parsed.proofId,
      shareToken: parsed.shareToken,
      simulation: parsed.simulation,
      result: parsed.result,
      urgencyMonths: parsed.urgencyMonths,
      hasMinorChildren: parsed.hasMinorChildren,
      simulationId: session.simulationId ?? undefined,
    });

    if (!outcome.listed) {
      return NextResponse.json({
        success: true,
        listed: false,
        reason: outcome.reason,
        message: outcome.message,
      });
    }

    return NextResponse.json({
      success: true,
      listed: true,
      marketplaceLeadId: outcome.marketplaceLeadId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "VALIDATION_ERROR", details: error.flatten() }, { status: 400 });
    }
    console.error("Marketplace publish error:", error);
    return NextResponse.json({ error: "Publish failed" }, { status: 500 });
  }
}
