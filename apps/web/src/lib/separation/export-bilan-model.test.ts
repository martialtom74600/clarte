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
  mortgageRemaining: 200000,
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
    expect(bilan?.footprint).toHaveLength(5);
    expect(bilan?.activeLevers).toHaveLength(1);
    expect(bilan?.ledger.lines.some((l) => l.id === "soulte")).toBe(true);
  });
});
