import { NextResponse } from "next/server";
import { resolveRentMarket } from "@/lib/market/rent-market";

/** GET /api/market/rent?postalCode=75011 — loyer zone (Carte des loyers + fallback). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postalCode = searchParams.get("postalCode") ?? "";

  if (postalCode.replace(/\D/g, "").length < 5) {
    return NextResponse.json({ error: "Invalid postal code" }, { status: 400 });
  }

  const market = await resolveRentMarket(postalCode);
  return NextResponse.json(market);
}
