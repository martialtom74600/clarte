import { describe, it, expect } from "vitest";
import { buildExpertExportPack } from "@/lib/separation/export-bilan-model";
import { generateExpertBilanPdf } from "@/lib/expert-bilan-pdf";
import { recomputeSeparationDerived } from "@/lib/separation/recompute-derived";
import { defaultAssumptions, defaultLabState } from "@/lib/separation/compile-simulation-input";
import type { FootprintState } from "@/lib/separation/separation-types";

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

describe("expert-bilan-pdf", () => {
  it("génère un Buffer PDF multi-pages non vide", async () => {
    const lab = {
      ...defaultLabState(),
      activeDoor: "sell" as const,
      enabledLevers: ["relocate_housing" as const],
      overrides: {
        relocate_housing: { surfaceSqm: 56, marketTier: "median" as const },
      },
    };
    const derived = recomputeSeparationDerived({
      stratum: "laboratoire",
      footprint,
      assumptions: defaultAssumptions(),
      lab,
      marketBuy: null,
      marketRent: null,
      derived: { lastInput: null, lastResult: null, doorVerdicts: null, computedAt: null },
      discreteMode: false,
    });
    const pack = buildExpertExportPack({
      footprint,
      assumptions: defaultAssumptions(),
      lab,
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    expect(pack).not.toBeNull();
    const buf = await generateExpertBilanPdf(pack!);
    expect(buf.length).toBeGreaterThan(8_000);
    expect(buf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  }, 30_000);
});
