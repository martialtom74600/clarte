import { getSimulationByToken } from "@/lib/supabase";
import { getMediationSession, updateMediationSession } from "@/lib/mediation-store";
import { compareMediationInputs } from "@separation/engine";
import { NextResponse } from "next/server";

async function loadSession(token: string) {
  const memory = getMediationSession(token);
  if (memory) return memory;

  const db = await getSimulationByToken(`med-${token}`);
  if (db) return db.input_data as Record<string, unknown>;
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const data = await loadSession(token);

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: data.status ?? "awaiting_party_b",
    hasPartyB: !!data.partyB,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const data = await loadSession(token);

    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const partyBData = body.partyBData;
    const comparison = compareMediationInputs(
      (data.partyA as Record<string, unknown>) ?? {},
      partyBData ?? {}
    );

    updateMediationSession(token, {
      partyB: partyBData,
      status: "compared",
      comparison,
    });

    return NextResponse.json({ comparison });
  } catch (error) {
    console.error("Mediation submit error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
