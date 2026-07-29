import { saveSimulation } from "@/lib/supabase";
import { saveMediationSession } from "@/lib/mediation-store";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { partyAData, tenantId } = body;

    const token = crypto.randomUUID().slice(0, 16);
    const sessionData = { partyA: partyAData, status: "awaiting_party_b", tenantId };

    saveMediationSession(token, sessionData);

    await saveSimulation({
      tenant_id: tenantId ?? "default",
      input_data: sessionData,
      result_data: {},
      share_token: `med-${token}`,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    return NextResponse.json({
      token,
      link: `${baseUrl}/mediation/${token}`,
    });
  } catch (error) {
    console.error("Mediation create error:", error);
    return NextResponse.json({ error: "Failed to create mediation" }, { status: 500 });
  }
}
