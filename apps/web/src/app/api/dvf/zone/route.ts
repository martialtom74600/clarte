import { NextResponse } from "next/server";
import { buildZoneMarketSnapshot, resolveZoneDepartments } from "@separation/engine";

const FALLBACK_PRICE_PER_SQM: Record<string, number> = {
  "75": 10500,
  "92": 6200,
  "93": 4800,
  "94": 5100,
  "69": 4800,
  "13": 3500,
  "33": 4200,
  "06": 5200,
  default: 2800,
};

interface DvfRecord {
  valeur_fonciere?: number;
  surface_reelle_bati?: number;
  code_postal?: string;
}

async function medianPriceForPostal(postalCode: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.cquest.org/dvf?code_postal=${postalCode}&limit=50`,
      { next: { revalidate: 86400 } }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as DvfRecord[];
    const valid = data.filter(
      (r) => r.valeur_fonciere && r.surface_reelle_bati && r.surface_reelle_bati > 10
    );
    if (valid.length === 0) return null;
    const prices = valid
      .map((r) => r.valeur_fonciere! / r.surface_reelle_bati!)
      .sort((a, b) => a - b);
    return Math.round(prices[Math.floor(prices.length / 2)]);
  } catch {
    return null;
  }
}

function fallbackPrice(dept: string): number {
  return FALLBACK_PRICE_PER_SQM[dept] ?? FALLBACK_PRICE_PER_SQM.default;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postalCode = searchParams.get("postalCode");
  const surface = Number(searchParams.get("surface") ?? 65);

  if (!postalCode || postalCode.length < 5) {
    return NextResponse.json({ error: "Invalid postal code" }, { status: 400 });
  }

  const departments = resolveZoneDepartments(postalCode);
  const deptPrices: number[] = [];

  const primaryMedian = await medianPriceForPostal(postalCode);
  if (primaryMedian) deptPrices.push(primaryMedian);

  for (const dept of departments) {
    if (deptPrices.length >= 3) break;
    const samplePostal = dept === postalCode.slice(0, 2) ? postalCode : `${dept}000`;
    const median = await medianPriceForPostal(samplePostal);
    deptPrices.push(median ?? fallbackPrice(dept));
  }

  if (deptPrices.length === 0) {
    deptPrices.push(fallbackPrice(postalCode.slice(0, 2)));
  }

  deptPrices.sort((a, b) => a - b);
  const zone = buildZoneMarketSnapshot(postalCode, surface, {
    departments,
    minPricePerSqm: { amount: deptPrices[0], currency: "EUR" },
    medianPricePerSqm: {
      amount: deptPrices[Math.floor(deptPrices.length / 2)],
      currency: "EUR",
    },
    maxPricePerSqm: {
      amount: deptPrices[deptPrices.length - 1],
      currency: "EUR",
    },
  });

  return NextResponse.json({
    ...zone,
    estimatedValueAtSurface: Math.round(zone.medianPricePerSqm.amount * surface),
  });
}
