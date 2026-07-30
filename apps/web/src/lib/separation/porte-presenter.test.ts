import { buildAllPortes, buildPortePresentation } from "@/lib/separation/porte-presenter";
import { recomputeSeparationDerived } from "@/lib/separation/recompute-derived";
import { defaultAssumptions, defaultLabState } from "@/lib/separation/compile-simulation-input";
import type { FootprintState } from "@/lib/separation/separation-types";
import { describe, it, expect } from "vitest";

const footprint: FootprintState = {
  postalCode: "75011",
  propertyValue: 400000,
  mortgageRemaining: 200000,
  incomeA: 5000,
  incomeB: 4000,
  completedAt: "2026-01-01T00:00:00.000Z",
};

describe("porte-presenter", () => {
  const { lastResult, doorVerdicts } = recomputeSeparationDerived({
    stratum: "portes",
    footprint,
    assumptions: defaultAssumptions(),
    lab: defaultLabState(),
    derived: { lastInput: null, lastResult: null, doorVerdicts: null, computedAt: null },
    discreteMode: false,
  });

  it("produit 4 portes avec titre et verdict", () => {
    const portes = buildAllPortes(lastResult, doorVerdicts);
    expect(portes).toHaveLength(4);
    expect(portes[0].title).toBe("Vous rachetez");
    expect(portes[3].title).toBe("Garder et louer");
    expect(["green", "orange", "red"]).toContain(portes[0].verdict);
  });

  it("affiche le montant de rachat pour keep_a", () => {
    const porte = buildPortePresentation("keep_a", lastResult, doorVerdicts);
    expect(porte?.heroCaption).toBe("pour garder le bien");
    expect(porte?.heroValue).toContain("€");
  });

  it("affiche le cashflow pour rent_out", () => {
    const porte = buildPortePresentation("rent_out", lastResult, doorVerdicts);
    expect(porte?.heroCaption).toBe("reste chaque mois");
    expect(porte?.consequence.length).toBeGreaterThan(0);
  });
});
