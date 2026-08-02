import { describe, expect, it } from "vitest";
import type { SimulationInput } from "@separation/schemas";
import { eur } from "./utils.js";
import {
  clampRelocateSurfaceSqm,
  defaultRelocateSurfaceSqm,
  resolveRelocateHousing,
} from "./relocate-housing.js";

function baseInput(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    status: "concubinage",
    persons: [
      { id: "A", income: eur(5000) },
      { id: "B", income: eur(4000) },
    ],
    assets: [],
    liabilities: [],
    options: { scenario: "compare_all" },
    postalCode: "75011",
    propertySurface: 100,
    ...overrides,
  };
}

describe("defaultRelocateSurfaceSqm", () => {
  it("100 m² → 55 m² (55 %)", () => {
    expect(defaultRelocateSurfaceSqm(100)).toBe(55);
  });

  it("80 m² → 44 m²", () => {
    expect(defaultRelocateSurfaceSqm(80)).toBe(44);
  });

  it("applique le plancher 35", () => {
    expect(defaultRelocateSurfaceSqm(40)).toBe(35);
  });

  it("65 m² → 36 m² (entier)", () => {
    expect(defaultRelocateSurfaceSqm(65)).toBe(36);
  });

  it("ajoute 12 m² par enfant (plafond 110)", () => {
    expect(defaultRelocateSurfaceSqm(100, 2)).toBe(79);
  });
});

describe("resolveRelocateHousing", () => {
  it("défaut : surface 55 % · entrée de zone", () => {
    const h = resolveRelocateHousing(baseInput());
    expect(h.surfaceSqm).toBe(55);
    expect(h.tier).toBe("entry");
    expect(h.isDefault).toBe(true);
    expect(h.note).toMatch(/55 m²/);
    expect(h.note).toMatch(/entrée de zone/);
    expect(h.targetPrice.amount).toBeGreaterThan(0);
    expect(h.tenantRentMonthly.amount).toBeGreaterThan(0);
  });

  it("override surface 70 + médian", () => {
    const h = resolveRelocateHousing(
      baseInput({
        options: {
          scenario: "compare_all",
          relocateSurfaceSqm: 70,
          relocateMarketTier: "median",
        },
      })
    );
    expect(h.surfaceSqm).toBe(70);
    expect(h.tier).toBe("median");
    expect(h.isDefault).toBe(false);
    expect(h.note).toMatch(/70 m²/);
    expect(h.note).toMatch(/médiane/);
  });

  it("Paris : la gamme change le €/m² (fourchette multi-départements)", () => {
    const entry = resolveRelocateHousing(
      baseInput({
        options: { scenario: "compare_all", relocateSurfaceSqm: 56, relocateMarketTier: "entry" },
      })
    );
    const median = resolveRelocateHousing(
      baseInput({
        options: { scenario: "compare_all", relocateSurfaceSqm: 56, relocateMarketTier: "median" },
      })
    );
    const high = resolveRelocateHousing(
      baseInput({
        options: { scenario: "compare_all", relocateSurfaceSqm: 56, relocateMarketTier: "high" },
      })
    );
    expect(entry.targetPrice.amount).toBeLessThan(median.targetPrice.amount);
    expect(median.targetPrice.amount).toBeLessThan(high.targetPrice.amount);
  });

  it("département hors zone élargie : la gamme applique des coefficients achat", () => {
    const entry = resolveRelocateHousing(
      baseInput({
        postalCode: "44000",
        options: { scenario: "compare_all", relocateSurfaceSqm: 56, relocateMarketTier: "entry" },
      })
    );
    const median = resolveRelocateHousing(
      baseInput({
        postalCode: "44000",
        options: { scenario: "compare_all", relocateSurfaceSqm: 56, relocateMarketTier: "median" },
      })
    );
    const high = resolveRelocateHousing(
      baseInput({
        postalCode: "44000",
        options: { scenario: "compare_all", relocateSurfaceSqm: 56, relocateMarketTier: "high" },
      })
    );
    // 44 (Loire-Atlantique) — barème départemental nationwide
    expect(entry.pricePerSqm).toBe(Math.round(3600 * 0.85));
    expect(median.pricePerSqm).toBe(3600);
    expect(high.pricePerSqm).toBe(Math.round(3600 * 1.25));
    expect(entry.targetPrice.amount).toBeLessThan(median.targetPrice.amount);
    expect(median.targetPrice.amount).toBeLessThan(high.targetPrice.amount);
  });

  it("utilise les prix zone injectés (DVF) de façon synchrone", () => {
    const h = resolveRelocateHousing(
      baseInput({
        postalCode: "75011",
        zoneMedianPricePerSqm: 10000,
        zoneMinPricePerSqm: 8500,
        zoneMaxPricePerSqm: 12500,
        zonePriceSource: "dvf",
        options: { scenario: "compare_all", relocateSurfaceSqm: 50, relocateMarketTier: "median" },
      })
    );
    expect(h.pricePerSqm).toBe(10000);
    expect(h.targetPrice.amount).toBe(500_000);
    expect(h.note).toMatch(/DVF/);

    const entry = resolveRelocateHousing(
      baseInput({
        postalCode: "75011",
        zoneMedianPricePerSqm: 10000,
        zoneMinPricePerSqm: 8500,
        zoneMaxPricePerSqm: 12500,
        zonePriceSource: "dvf",
        options: { scenario: "compare_all", relocateSurfaceSqm: 50, relocateMarketTier: "entry" },
      })
    );
    expect(entry.pricePerSqm).toBe(8500);
  });

  it("utilise les loyers zone injectés (Carte des loyers) de façon synchrone", () => {
    const median = resolveRelocateHousing(
      baseInput({
        postalCode: "75011",
        zoneRentMedianPerSqm: 31.72,
        zoneRentMinPerSqm: 25.17,
        zoneRentMaxPerSqm: 39.98,
        zoneRentSource: "carte_loyers",
        options: { scenario: "compare_all", relocateSurfaceSqm: 50, relocateMarketTier: "median" },
      })
    );
    expect(median.tenantRentMonthly.amount).toBeCloseTo(31.72 * 50, 1);
    expect(median.note).toMatch(/Carte des loyers/);

    const entry = resolveRelocateHousing(
      baseInput({
        postalCode: "75011",
        zoneRentMedianPerSqm: 31.72,
        zoneRentMinPerSqm: 25.17,
        zoneRentMaxPerSqm: 39.98,
        zoneRentSource: "carte_loyers",
        options: { scenario: "compare_all", relocateSurfaceSqm: 50, relocateMarketTier: "entry" },
      })
    );
    expect(entry.tenantRentMonthly.amount).toBeCloseTo(25.17 * 50, 1);
    expect(entry.tenantRentMonthly.amount).toBeLessThan(median.tenantRentMonthly.amount);
  });

  it("clamp surface override", () => {
    expect(clampRelocateSurfaceSqm(10)).toBe(25);
    expect(clampRelocateSurfaceSqm(200)).toBe(150);
  });

  it("enfants actifs agrandissent le défaut", () => {
    const h = resolveRelocateHousing(
      baseInput({
        hasMinorChildren: true,
        numberOfChildren: 2,
      })
    );
    expect(h.surfaceSqm).toBe(79);
  });
});
