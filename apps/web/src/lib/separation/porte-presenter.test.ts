import {
  buildAllPortes,
  buildPortePresentation,
  groupPortes,
  pickFeaturedDoorId,
} from "@/lib/separation/porte-presenter";
import { recomputeSeparationDerived } from "@/lib/separation/recompute-derived";
import { defaultAssumptions, defaultLabState } from "@/lib/separation/compile-simulation-input";
import type { FootprintState } from "@/lib/separation/separation-types";
import { describe, it, expect } from "vitest";

const footprint: FootprintState = {
  postalCode: "75011",
  propertyValue: 400000,
  propertySurface: 65,
  purchasePrice: 320000,
  mortgageRemaining: 200000,
  monthlyMortgagePayment: 950,
  mortgageRemainingYears: 15,
  initialMortgagePrincipal: 0,
  initialMortgageDurationYears: 0,
  mortgageStartMonth: 0,
  mortgageStartYear: 0,
  initialMortgageRate: 0,
  mortgageInsuranceRate: 0.0034,
  mortgageInsuranceMonthly: 0,
  incomeA: 5000,
  incomeB: 4000,
  contributionA: 0,
  contributionB: 0,
  legalStatus: "concubinage",
  ownershipShareA: 50,
  ownershipShareB: 50,
  cadreJuridiqueDeclared: true,
  apportsDeclared: true,
  financementDeclared: true,
  completedAt: "2026-01-01T00:00:00.000Z",
};

describe("porte-presenter", () => {
  const { lastResult, doorVerdicts } = recomputeSeparationDerived({
    footprint,
    assumptions: defaultAssumptions(),
    lab: defaultLabState(),
    marketBuy: null,
    marketRent: null,
  });

  it("produit 5 portes avec titre et verdict", () => {
    const portes = buildAllPortes(lastResult, doorVerdicts, footprint);
    expect(portes).toHaveLength(5);
    expect(portes[0].title).toBe("Vous rachetez");
    expect(portes[2].title).toBe("Vendre pour se reloger");
    expect(portes[3].title).toBe("Vendre puis louer");
    expect(portes[4].title).toBe("Garder et louer");
    expect(["green", "orange", "red"]).toContain(portes[0].verdict);
  });

  it("groupe les portes et met en avant le meilleur verdict", () => {
    const portes = buildAllPortes(lastResult, doorVerdicts, footprint);
    const featuredId = pickFeaturedDoorId(portes);
    expect(featuredId).toBeTruthy();
    const featured = portes.find((p) => p.doorId === featuredId)!;
    for (const other of portes) {
      const rank = { green: 0, orange: 1, red: 2 } as const;
      expect(rank[featured.verdict]).toBeLessThanOrEqual(rank[other.verdict]);
    }
    const groups = groupPortes(portes, { excludeDoorId: featuredId });
    expect(groups.length).toBeGreaterThanOrEqual(2);
    expect(groups.flatMap((g) => g.portes)).toHaveLength(4);
    expect(groups.every((g) => g.portes.every((p) => p.doorId !== featuredId))).toBe(true);
  });

  it("affiche le montant de rachat pour keep_a", () => {
    const porte = buildPortePresentation("keep_a", lastResult, doorVerdicts, footprint);
    expect(porte?.heroCaption).toMatch(/crédit actuel|garder le bien/);
    expect(porte?.heroValue).toContain("€");
    expect(porte?.bilateral).toHaveLength(2);
    expect(porte?.bilateral?.[1].caption).toMatch(/capital net/i);
    expect(porte?.bilateral?.[1].relocateVerdict).toMatch(/green|orange|red/);
  });

  it("affiche le cashflow pour rent_out", () => {
    const porte = buildPortePresentation("rent_out", lastResult, doorVerdicts, footprint);
    expect(porte?.heroCaption).toBe("cashflow net / mois");
    expect(porte?.consequence.length).toBeGreaterThan(0);
    expect(porte?.bilateral).toHaveLength(2);
    expect(porte?.bilateral?.[0].personLabel).toBe("Vous");
    expect(porte?.consequence).toMatch(/micro-foncier|Loyer|créd/);
  });

  it("affiche un hero bilatéral pour sell", () => {
    const porte = buildPortePresentation("sell", lastResult, doorVerdicts, footprint);
    expect(porte?.bilateral).toHaveLength(2);
    expect(porte?.bilateral?.[0].personLabel).toBe("Vous");
    expect(porte?.bilateral?.[1].personLabel).toBe("L'autre");
    expect(porte?.bilateral?.[0].relocateVerdict).toMatch(/green|orange|red/);
    expect(porte?.bilateral?.[1].relocateVerdict).toMatch(/green|orange|red/);
  });

  it("affiche un hero bilatéral pour sell_rent avec loyer", () => {
    const porte = buildPortePresentation("sell_rent", lastResult, doorVerdicts, footprint);
    expect(porte?.title).toBe("Vendre puis louer");
    expect(porte?.bilateral).toHaveLength(2);
    expect(porte?.consequence).toMatch(/location/i);
    expect(porte?.bilateral?.[0].relocateLabel).toMatch(/Loyer solo/i);
  });

  it("surfacer les parts 60/40 sur sell et keep", () => {
    const unequal: FootprintState = {
      ...footprint,
      ownershipShareA: 60,
      ownershipShareB: 40,
    };
    const derived = recomputeSeparationDerived({
      footprint: unequal,
      assumptions: { ...defaultAssumptions(), shareA: 60, shareB: 40 },
      lab: defaultLabState(),
    });
    const sell = buildPortePresentation(
      "sell",
      derived.lastResult,
      derived.doorVerdicts,
      unequal
    );
    expect(sell?.heroCaption).toContain("60 %");
    expect(sell?.bilateral?.[0].caption).toContain("60 %");
    expect(sell?.bilateral?.[1].caption).toContain("40 %");

    const keep = buildPortePresentation(
      "keep_a",
      derived.lastResult,
      derived.doorVerdicts,
      unequal
    );
    expect(keep?.bilateral?.[0].caption).toMatch(/40 %/);
  });
});
