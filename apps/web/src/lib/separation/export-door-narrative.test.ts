import { describe, it, expect } from "vitest";
import {
  buildDoorHowItWorks,
  buildDoorNextSteps,
  buildMatrixRow,
} from "./export-door-narrative";
import { buildExpertExportPack } from "./export-bilan-model";
import { recomputeSeparationDerived } from "./recompute-derived";
import { defaultAssumptions, defaultLabState } from "./compile-simulation-input";
import type { FootprintState } from "./separation-types";
import { DOOR_ORDER } from "./porte-presenter";

const footprint: FootprintState = {
  postalCode: "74600",
  propertyValue: 400000,
  propertySurface: 102,
  purchasePrice: 380000,
  mortgageRemaining: 248984,
  monthlyMortgagePayment: 1200,
  mortgageRemainingYears: 18,
  initialMortgagePrincipal: 320000,
  initialMortgageDurationYears: 25,
  mortgageStartMonth: 1,
  mortgageStartYear: 2021,
  initialMortgageRate: 0.012,
  mortgageInsuranceRate: 0.0034,
  mortgageInsuranceMonthly: 85,
  incomeA: 4000,
  incomeB: 3500,
  contributionA: 40000,
  contributionB: 20000,
  legalStatus: "concubinage",
  ownershipShareA: 50,
  ownershipShareB: 50,
  cadreJuridiqueDeclared: true,
  apportsDeclared: true,
  financementDeclared: true,
  completedAt: "2026-01-01T00:00:00.000Z",
};

describe("export-door-narrative", () => {
  const baseState = {
    stratum: "laboratoire" as const,
    footprint,
    assumptions: defaultAssumptions(),
    lab: {
      ...defaultLabState(),
      activeDoor: "sell" as const,
      enabledLevers: ["relocate_housing" as const, "initial_contributions" as const],
      overrides: {
        relocate_housing: { surfaceSqm: 56, marketTier: "median" as const },
        initial_contributions: { contributionA: 40000, contributionB: 20000 },
      },
    },
    marketBuy: null,
    marketRent: null,
    derived: { lastInput: null, lastResult: null, doorVerdicts: null, computedAt: null },
    discreteMode: false,
  };

  const derived = recomputeSeparationDerived(baseState);

  it("produit des blocs pédagogiques non vides pour chaque porte", () => {
    for (const doorId of DOOR_ORDER) {
      const blocks = buildDoorHowItWorks(doorId, derived.lastResult);
      expect(blocks.length).toBeGreaterThanOrEqual(2);
      for (const block of blocks) {
        expect(block.title.length).toBeGreaterThan(2);
        expect(block.body.length).toBeGreaterThan(40);
      }
      const steps = buildDoorNextSteps(doorId, derived.lastResult, derived.doorVerdicts);
      expect(steps.length).toBeGreaterThanOrEqual(2);
      expect(steps.length).toBeLessThanOrEqual(3);
    }
  });

  it("construit une matrice à 5 lignes", () => {
    const rows = DOOR_ORDER.map((id) =>
      buildMatrixRow(id, derived.lastResult, derived.doorVerdicts)
    );
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.verdictLabel.length > 0)).toBe(true);
    expect(rows.find((r) => r.doorId === "sell")?.cashLabel).toMatch(/€|—/);
  });

  it("assemble un pack expert avec la porte active en premier", () => {
    const pack = buildExpertExportPack({
      footprint,
      assumptions: defaultAssumptions(),
      lab: baseState.lab,
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
      date: new Date("2026-08-03T10:00:00.000Z"),
    });
    expect(pack).not.toBeNull();
    expect(pack!.chapters).toHaveLength(5);
    expect(pack!.chapters[0].doorId).toBe("sell");
    expect(pack!.matrix).toHaveLength(5);
    expect(pack!.chapters.every((c) => c.howItWorks.length >= 2)).toBe(true);
    expect(pack!.chapters.every((c) => c.nextSteps.length >= 2)).toBe(true);
    expect(pack!.disclaimer).toMatch(/2026\.6/);
    expect(pack!.coverSubtitle).toMatch(/74600/);
  });
});
