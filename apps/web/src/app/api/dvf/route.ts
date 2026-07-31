import { NextResponse } from "next/server";
import { pricePerSqmForPostal } from "@separation/engine";

interface DvfRecord {
  valeur_fonciere?: number;
  surface_reelle_bati?: number;
  code_postal?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postalCode = searchParams.get("postalCode");
  const surface = Number(searchParams.get("surface") ?? 70);

  if (!postalCode || postalCode.length < 5) {
    return NextResponse.json({ error: "Invalid postal code" }, { status: 400 });
  }

  let estimatedValue: number | null = null;
  let source = "fallback";
  let medianPricePerSqm: number | null = null;

  try {
    const apiUrl = `https://api.cquest.org/dvf?code_postal=${postalCode}&limit=50`;

    const response = await fetch(apiUrl, {
      next: { revalidate: 86400 },
    });

    if (response.ok) {
      const data = (await response.json()) as DvfRecord[];
      const valid = data.filter(
        (r) =>
          r.valeur_fonciere &&
          r.surface_reelle_bati &&
          r.surface_reelle_bati > 10
      );

      if (valid.length > 0) {
        const pricesPerSqm = valid.map(
          (r) => r.valeur_fonciere! / r.surface_reelle_bati!
        );
        pricesPerSqm.sort((a, b) => a - b);
        medianPricePerSqm = pricesPerSqm[Math.floor(pricesPerSqm.length / 2)];
        estimatedValue = Math.round(medianPricePerSqm * surface);
        source = "dvf";
      }
    }
  } catch (error) {
    console.warn("DVF API unavailable, using fallback:", error);
  }

  if (!estimatedValue) {
    medianPricePerSqm = pricePerSqmForPostal(postalCode);
    estimatedValue = Math.round(medianPricePerSqm * surface);
    source = "fallback";
  }

  return NextResponse.json({
    postalCode,
    surface,
    estimatedValue,
    medianPricePerSqm,
    source,
    disclaimer:
      "Estimation indicative basée sur les transactions DVF ou données de référence. Ajustez selon l'état et les travaux du bien.",
  });
}
