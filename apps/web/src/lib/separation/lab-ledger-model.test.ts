import { describe, it, expect } from "vitest";
import { buildLabLedger } from "@/lib/separation/lab-ledger-model";
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

describe("buildLabLedger", () => {
  const baseState = {
    stratum: "laboratoire" as const,
    footprint,
    assumptions: defaultAssumptions(),
    lab: { ...defaultLabState(), activeDoor: "keep_a" as const },
    derived: { lastInput: null, lastResult: null, doorVerdicts: null, computedAt: null },
    discreteMode: false,
  };

  const derived = recomputeSeparationDerived(baseState);

  it("décompose le calcul pour keep_a", () => {
    const ledger = buildLabLedger({
      doorId: "keep_a",
      footprint,
      assumptions: defaultAssumptions(),
      lab: baseState.lab,
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    expect(ledger?.lines.some((l) => l.id === "property")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "soulte")).toBe(true);
    expect(ledger?.verdict?.verdict).toBeDefined();
  });

  it("intègre les apports quand le levier est actif", () => {
    const lab = {
      ...defaultLabState(),
      activeDoor: "keep_a" as const,
      enabledLevers: ["initial_contributions" as const],
      overrides: {
        initial_contributions: { contributionA: 20000, contributionB: 30000 },
      },
    };
    const withApports = recomputeSeparationDerived({ ...baseState, lab });
    const ledger = buildLabLedger({
      doorId: "keep_a",
      footprint,
      assumptions: defaultAssumptions(),
      lab,
      result: withApports.lastResult,
      doorVerdicts: withApports.doorVerdicts,
    });
    expect(ledger?.lines.some((l) => l.id === "contributions")).toBe(true);
    const soulte = withApports.lastResult?.scenarios.find((s) => s.scenario === "keep_a")?.soulte
      ?.amount.amount;
    expect(soulte).toBe(120000);
  });

  it("avec garder mon crédit : affiche crédit conservé + nouveau prêt rachat", () => {
    const lab = {
      ...defaultLabState(),
      activeDoor: "keep_a" as const,
      enabledLevers: ["historical_mortgage_rate" as const],
      overrides: {
        historical_mortgage_rate: { monthlyMortgagePayment: 950 },
      },
    };
    const derivedHist = recomputeSeparationDerived({ ...baseState, lab });
    const keep = derivedHist.lastResult?.scenarios.find((s) => s.scenario === "keep_a");
    expect(keep?.keepFinancingMode).toBe("keep_existing_loan");

    const ledger = buildLabLedger({
      doorId: "keep_a",
      footprint,
      assumptions: defaultAssumptions(),
      lab,
      result: derivedHist.lastResult,
      doorVerdicts: derivedHist.doorVerdicts,
    });
    expect(ledger?.lines.some((l) => l.id === "kept-mortgage")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "new-loan")).toBe(true);
    expect(ledger?.lines.find((l) => l.id === "kept-mortgage")?.amount).toBe(950);
    expect(ledger?.footer).toMatch(/désolidarisation|banque/i);
  });

  it("vente : affiche agence, diagnostics et parts bilatérales", () => {
    const ledger = buildLabLedger({
      doorId: "sell",
      footprint,
      assumptions: defaultAssumptions(),
      lab: { ...defaultLabState(), activeDoor: "sell" },
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    expect(ledger?.lines.some((l) => l.id === "agency")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "diagnostics")).toBe(true);
    expect(ledger?.lines.find((l) => l.id === "agency")?.amount).toBe(20000);
    expect(ledger?.lines.find((l) => l.id === "diagnostics")?.amount).toBe(1800);
    expect(ledger?.lines.find((l) => l.id === "net")?.amount).toBe(178200);
    expect(ledger?.lines.find((l) => l.id === "you")?.amount).toBe(89100);
    expect(ledger?.lines.find((l) => l.id === "other")?.amount).toBe(89100);
    expect(ledger?.footer).toMatch(/150 U|Relogement/i);
  });
});
