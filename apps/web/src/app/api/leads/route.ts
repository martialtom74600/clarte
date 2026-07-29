import { scoreLead, buildLeadPayload } from "@separation/lead-scoring";
import { leadQualificationSchema, simulationInputSchema } from "@separation/schemas";
import type { SimulationInput, SimulationResult } from "@separation/schemas";
import { saveLead, saveSimulation } from "@/lib/supabase";
import { generateSimulationPdf } from "@/lib/pdf";
import { NextResponse } from "next/server";
import { Resend } from "resend";

async function sendPartnerWebhook(payload: Record<string, unknown>) {
  const webhookUrl = process.env.PARTNER_WEBHOOK_URL;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.PARTNER_WEBHOOK_SECRET
        ? { "X-Webhook-Secret": process.env.PARTNER_WEBHOOK_SECRET }
        : {}),
    },
    body: JSON.stringify(payload),
  });
}

async function sendReportEmail(
  email: string,
  simulation: SimulationInput,
  result: SimulationResult,
  proofId?: string
) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("Resend not configured, skipping email");
    return;
  }

  const resend = new Resend(resendKey);
  const pdfBuffer = await generateSimulationPdf(simulation, result, email, proofId);

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "Clarté <noreply@example.com>",
    to: email,
    subject: "Votre rapport de simulation patrimoniale — Clarté",
    html: `
      <p>Bonjour,</p>
      <p>Voici votre rapport de simulation patrimoniale en pièce jointe.</p>
      <p>Ce document est une simulation indicative. Consultez un notaire ou avocat avant toute décision.</p>
      <p>L'équipe Clarté</p>
    `,
    attachments: [
      {
        filename: "clarte-simulation.pdf",
        content: pdfBuffer,
      },
    ],
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      email,
      phone,
      simulation,
      result,
      urgencyMonths,
      hasMinorChildren,
      scenarioPreference,
      tenantId,
      proofId,
      postalCode,
    } = body as {
      email: string;
      phone?: string;
      postalCode?: string;
      simulation: SimulationInput;
      result: SimulationResult;
      urgencyMonths?: number;
      hasMinorChildren?: boolean;
      scenarioPreference?: SimulationInput["options"]["scenario"];
      tenantId?: string;
      proofId?: string;
    };

    const qualification = leadQualificationSchema.parse({
      email,
      urgencyMonths,
      hasMinorChildren,
      optInPartnerMatch: false,
      scenarioPreference,
      tenantId: tenantId ?? simulation.tenantId,
    });

    simulationInputSchema.parse(simulation);

    const leadScore = scoreLead(qualification, simulation, result);
    const payload = buildLeadPayload(qualification, simulation, result, leadScore);

    const shareToken = crypto.randomUUID().slice(0, 12);

    const savedSimulation = await saveSimulation({
      tenant_id: payload.tenantId,
      input_data: { ...simulation as unknown as Record<string, unknown>, postalCode },
      result_data: result as unknown as Record<string, unknown>,
      share_token: shareToken,
    });

    const savedLead = await saveLead({
      email: qualification.email,
      phone: phone?.trim() || null,
      tenant_id: payload.tenantId,
      score: leadScore.score,
      tier: leadScore.tier,
      qualifies_for_cpl: leadScore.qualifiesForCpl,
      recommended_partners: leadScore.recommendedPartners,
      simulation_data: {
        ...payload.simulationSummary,
        phone: phone?.trim() || null,
        shareToken,
      },
    });

    await sendReportEmail(email, simulation, result, proofId);

    if (leadScore.qualifiesForCpl) {
      await sendPartnerWebhook({
        ...payload,
        leadId: savedLead?.id,
        shareToken,
      });
    }

    return NextResponse.json({
      success: true,
      leadScore,
      shareToken,
      simulationId: savedSimulation?.id,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/partage/${shareToken}`,
    });
  } catch (error) {
    console.error("Lead capture error:", error);
    return NextResponse.json(
      { error: "Lead capture failed" },
      { status: 500 }
    );
  }
}
