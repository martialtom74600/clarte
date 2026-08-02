import { NextResponse } from "next/server";
import { resolveBuyMarket } from "@/lib/market/buy-market";

/** GET /api/market/buy?postalCode=75011 — marché achat DVF + fallback barème. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postalCode = searchParams.get("postalCode") ?? "";

  if (postalCode.replace(/\D/g, "").length < 5) {
    return NextResponse.json({ error: "Invalid postal code" }, { status: 400 });
  }

  const market = await resolveBuyMarket(postalCode);
  return NextResponse.json(market);
}
