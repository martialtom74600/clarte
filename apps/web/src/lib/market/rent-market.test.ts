import { beforeEach, describe, expect, it } from "vitest";
import {
  buildCarteLoyersIndex,
  clearRentMarketCache,
  parseCarteLoyersLine,
  resolveRentMarket,
  setCarteLoyersIndexForTests,
  type CarteLoyersRow,
} from "@/lib/market/rent-market";
import { arrondissementInseeFromPostal } from "@/lib/market/postal-insee";

describe("postal-insee arrondissements", () => {
  it("mappe Paris / Lyon / Marseille", () => {
    expect(arrondissementInseeFromPostal("75011")).toBe("75111");
    expect(arrondissementInseeFromPostal("69003")).toBe("69383");
    expect(arrondissementInseeFromPostal("13008")).toBe("13208");
    expect(arrondissementInseeFromPostal("44000")).toBeNull();
  });
});

describe("parseCarteLoyersLine", () => {
  it("parse une ligne CSV ANIL", () => {
    const row = parseCarteLoyersLine(
      '"2442";"75111";"Paris 11e Arrondissement";"200054781";"75";"11";31,72;25,17;39,98;"commune";17411;17411;0,91'
    );
    expect(row?.insee).toBe("75111");
    expect(row?.rentPerSqm).toBe(31.72);
    expect(row?.lowPerSqm).toBe(25.17);
    expect(row?.highPerSqm).toBe(39.98);
  });
});

describe("resolveRentMarket", () => {
  beforeEach(() => {
    clearRentMarketCache();
    setCarteLoyersIndexForTests(null);
  });

  it("bascule sur le barème si la carte est vide / introuvable", async () => {
    setCarteLoyersIndexForTests(new Map());
    const snap = await resolveRentMarket("44000", {
      bypassCache: true,
      fetchCommunes: async () => [{ nom: "Nantes", code: "44109" }],
    });
    expect(snap.source).toBe("fallback");
    expect(snap.medianRentPerSqm).toBe(13.5); // 44 — Loire-Atlantique
  });

  it("utilise la Carte des loyers quand la commune est trouvée", async () => {
    const index = new Map<string, CarteLoyersRow>([
      [
        "75111",
        {
          insee: "75111",
          name: "Paris 11e",
          rentPerSqm: 31.72,
          lowPerSqm: 25.17,
          highPerSqm: 39.98,
        },
      ],
    ]);
    setCarteLoyersIndexForTests(index);
    const snap = await resolveRentMarket("75011", {
      bypassCache: true,
      fetchCommunes: async () => [{ nom: "Paris", code: "75056" }],
    });
    expect(snap.source).toBe("carte_loyers");
    expect(snap.communeCode).toBe("75111");
    expect(snap.medianRentPerSqm).toBe(31.72);
    expect(snap.minRentPerSqm).toBe(25.17);
    expect(snap.maxRentPerSqm).toBe(39.98);
  });

  it("parse un extrait CSV en index", () => {
    const csv = `"id_zone";"INSEE_C";"LIBGEO";"EPCI";"DEP";"REG";"loypredm2";"lwr.IPm2";"upr.IPm2";"TYPPRED";"nbobs_com";"nbobs_mail";"R2_adj"
"1";"44109";"Nantes";"244400404";"44";"52";14,50;11,35;18,54;"commune";100;100;0,85
`;
    const index = buildCarteLoyersIndex(csv);
    expect(index.get("44109")?.rentPerSqm).toBe(14.5);
  });
});
