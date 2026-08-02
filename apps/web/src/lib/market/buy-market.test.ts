import { beforeEach, describe, expect, it } from "vitest";
import {
  clearBuyMarketCache,
  medianPriceFromDvfRecords,
  resolveBuyMarket,
  type DvfRecord,
} from "@/lib/market/buy-market";

function records(prices: { value: number; sqm: number }[]): DvfRecord[] {
  return prices.map((p) => ({
    valeur_fonciere: p.value,
    surface_reelle_bati: p.sqm,
  }));
}

describe("medianPriceFromDvfRecords", () => {
  it("exige au moins 5 transactions", () => {
    expect(
      medianPriceFromDvfRecords(
        records([
          { value: 300_000, sqm: 30 },
          { value: 400_000, sqm: 40 },
        ])
      )
    ).toBeNull();
  });

  it("calcule la médiane €/m²", () => {
    const result = medianPriceFromDvfRecords(
      records([
        { value: 200_000, sqm: 40 }, // 5000
        { value: 300_000, sqm: 50 }, // 6000
        { value: 350_000, sqm: 50 }, // 7000
        { value: 400_000, sqm: 50 }, // 8000
        { value: 500_000, sqm: 50 }, // 10000
      ])
    );
    expect(result?.count).toBe(5);
    expect(result?.median).toBe(7000);
  });
});

describe("resolveBuyMarket", () => {
  beforeEach(() => {
    clearBuyMarketCache();
  });

  it("bascule sur le barème si l'API est en panne", async () => {
    const snap = await resolveBuyMarket("44000", {
      bypassCache: true,
      fetchDvf: async () => {
        throw new Error("network down");
      },
    });
    // fetchDvf qui throw est catchée dans default path — notre mock doit retourner null
    expect(snap.source).toBe("fallback");
    expect(snap.medianPricePerSqm).toBe(3600); // 44 — Loire-Atlantique
    expect(snap.minPricePerSqm).toBe(Math.round(3600 * 0.85));
    expect(snap.maxPricePerSqm).toBe(Math.round(3600 * 1.25));
    expect(snap.asOfYear).toBeGreaterThanOrEqual(2025);
  });

  it("bascule sur le barème si fetch renvoie null", async () => {
    const snap = await resolveBuyMarket("31000", {
      bypassCache: true,
      fetchDvf: async () => null,
    });
    expect(snap.source).toBe("fallback");
    expect(snap.postalCode).toBe("31000");
    expect(snap.medianPricePerSqm).toBe(3600); // 31 — Haute-Garonne
  });

  it("utilise la médiane DVF commune quand assez de transactions", async () => {
    const snap = await resolveBuyMarket("75011", {
      bypassCache: true,
      fetchDvf: async () =>
        records([
          { value: 400_000, sqm: 40 },
          { value: 500_000, sqm: 50 },
          { value: 600_000, sqm: 50 },
          { value: 700_000, sqm: 50 },
          { value: 800_000, sqm: 50 },
        ]),
    });
    expect(snap.source).toBe("dvf");
    expect(snap.medianPricePerSqm).toBe(12_000); // 600000/50
    expect(snap.minPricePerSqm).toBe(Math.round(12_000 * 0.85));
    expect(snap.maxPricePerSqm).toBe(Math.round(12_000 * 1.25));
  });

  it("cache le résultat par code postal", async () => {
    let calls = 0;
    const fetchDvf = async () => {
      calls += 1;
      return records([
        { value: 300_000, sqm: 30 },
        { value: 300_000, sqm: 30 },
        { value: 300_000, sqm: 30 },
        { value: 300_000, sqm: 30 },
        { value: 300_000, sqm: 30 },
      ]);
    };
    const a = await resolveBuyMarket("69001", { fetchDvf });
    const b = await resolveBuyMarket("69001", { fetchDvf });
    expect(a.medianPricePerSqm).toBe(b.medianPricePerSqm);
    expect(calls).toBe(1);
  });
});
