import { NextResponse } from "next/server";
import { resolveBuyMarket } from "@/lib/market/buy-market";

/** GET /api/dvf?postalCode&surface — estimation valeur bien (service marché unifié). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postalCode = searchParams.get("postalCode");
  const surface = Number(searchParams.get("surface") ?? 70);

  if (!postalCode || postalCode.replace(/\D/g, "").length < 5) {
    return NextResponse.json({ error: "Invalid postal code" }, { status: 400 });
  }

  const sqm = surface > 0 ? surface : 70;
  const market = await resolveBuyMarket(postalCode);
  const estimatedValue = Math.round(market.medianPricePerSqm * sqm);

  return NextResponse.json({
    postalCode: market.postalCode,
    surface: sqm,
    estimatedValue,
    medianPricePerSqm: market.medianPricePerSqm,
    minPricePerSqm: market.minPricePerSqm,
    maxPricePerSqm: market.maxPricePerSqm,
    source: market.source,
    transactionCount: market.transactionCount,
    disclaimer:
      market.source === "fallback"
        ? "Estimation indicative (barème départemental). Ajustez selon l'état et les travaux du bien."
        : "Estimation indicative basée sur les transactions DVF. Ajustez selon l'état et les travaux du bien.",
  });
}
