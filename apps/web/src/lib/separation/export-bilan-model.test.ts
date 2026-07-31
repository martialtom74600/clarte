import { describe, it, expect } from "vitest";
import {
  buildActiveLeverLines,
  buildExportBilan,
  EXPORT_SCENARIO_TITLES,
  formatExportDate,
} from "@/lib/separation/export-bilan-model";
import { recomputeSeparationDerived } from "@/lib/separation/recompute-derived";
import { defaultAssumptions, defaultLabState } from "@/lib/separation/compile-simulation-input";
import type { FootprintState } from "@/lib/separation/separation-types";

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
  completedAt: "2026-01-01T00:00:00.000Z",
};

describe("export-bilan-model", () => {
  const baseState = {
    stratum: "laboratoire" as const,
    footprint,
    assumptions: defaultAssumptions(),
    lab: { ...defaultLabState(), activeDoor: "keep_a" as const },
    derived: { lastInput: null, lastResult: null, doorVerdicts: null, computedAt: null },
    discreteMode: false,
  };

  const derived = recomputeSeparationDerived(baseState);

  it("formate la date en français", () => {
    const label = formatExportDate(new Date("2026-07-30T12:00:00.000Z"));
    expect(label).toMatch(/30 juillet 2026/);
  });

  it("liste uniquement les leviers activés", () => {
    const lab = {
      ...defaultLabState(),
      enabledLevers: ["initial_contributions" as const, "historical_mortgage_rate" as const],
      overrides: {
        initial_contributions: { contributionA: 20000, contributionB: 30000 },
        historical_mortgage_rate: { monthlyMortgagePayment: 950 },
      },
    };

    const lines = buildActiveLeverLines(lab, footprint, defaultAssumptions());
    expect(lines).toHaveLength(2);
    expect(lines[0].value).toContain("20");
    expect(lines[0].value).toContain("30");
    expect(lines[1].value).toContain("/mois");
  });

  it("assemble le document exportable", () => {
    const lab = {
      ...defaultLabState(),
      activeDoor: "keep_a" as const,
      enabledLevers: ["initial_contributions" as const],
      overrides: {
        initial_contributions: { contributionA: 20000, contributionB: 30000 },
      },
    };

    const bilan = buildExportBilan({
      doorId: "keep_a",
      footprint,
      assumptions: defaultAssumptions(),
      lab,
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
      date: new Date("2026-07-30T12:00:00.000Z"),
    });

    expect(bilan?.scenarioTitle).toBe(EXPORT_SCENARIO_TITLES.keep_a);
    expect(bilan?.footprint.length).toBeGreaterThanOrEqual(5);
    expect(bilan?.activeLevers).toHaveLength(1);
    expect(bilan?.ledger.lines.some((l) => l.id === "soulte")).toBe(true);
    expect(bilan?.insights.length).toBeGreaterThan(0);
    expect(bilan?.insights.some((i) => /partant|Synthèse/i.test(i.title))).toBe(true);
    expect(bilan?.disclaimer).toMatch(/CGI 746/);
    expect(bilan?.disclaimer).toMatch(/1,5 %/);
    expect(bilan?.disclaimer).toMatch(/2026\.6/);
    expect(bilan?.disclaimer).toMatch(/815-13|1469/);
    expect(bilan?.disclaimer).not.toMatch(/7[,.]5 % de la soulte/);
  });

  it("exporte le détail fiscal rent_out et l'indemnité keep", () => {
    const rentBilan = buildExportBilan({
      doorId: "rent_out",
      footprint,
      assumptions: defaultAssumptions(),
      lab: { ...defaultLabState(), activeDoor: "rent_out" },
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    expect(rentBilan?.insights.some((i) => /micro-foncier|fiscal/i.test(i.title))).toBe(
      true
    );

    const occLab = {
      ...defaultLabState(),
      activeDoor: "keep_a" as const,
      enabledLevers: ["occupation_indemnity" as const],
      overrides: { occupation_indemnity: { occupationMonths: 8 } },
    };
    const occDerived = recomputeSeparationDerived({ ...baseState, lab: occLab });
    const keepBilan = buildExportBilan({
      doorId: "keep_a",
      footprint,
      assumptions: defaultAssumptions(),
      lab: occLab,
      result: occDerived.lastResult,
      doorVerdicts: occDerived.doorVerdicts,
    });
    expect(keepBilan?.activeLevers.some((l) => l.id === "occupation_indemnity")).toBe(true);
    expect(keepBilan?.insights.some((i) => /occupation/i.test(i.title + i.body))).toBe(
      true
    );
  });
});
