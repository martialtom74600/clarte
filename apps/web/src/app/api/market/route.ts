import { NextResponse } from "next/server";
import { resolveBuyMarket } from "@/lib/market/buy-market";
import { resolveRentMarket } from "@/lib/market/rent-market";

/** GET /api/market?postalCode=75011 — achat (DVF) + location (Carte des loyers). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postalCode = searchParams.get("postalCode") ?? "";

  if (postalCode.replace(/\D/g, "").length < 5) {
    return NextResponse.json({ error: "Invalid postal code" }, { status: 400 });
  }

  const [buy, rent] = await Promise.all([
    resolveBuyMarket(postalCode),
    resolveRentMarket(postalCode),
  ]);

  return NextResponse.json({
    buy,
    rent,
    coverage: "france",
    freshness: {
      buy: buy.source === "fallback" ? "barème départemental" : "DVF live",
      rent:
        rent.source === "carte_loyers"
          ? `Carte des loyers ${rent.asOfYear}`
          : "barème départemental",
    },
  });
}
