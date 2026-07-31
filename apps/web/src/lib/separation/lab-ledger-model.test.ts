import { describe, it, expect } from "vitest";
import { buildLabLedger } from "@/lib/separation/lab-ledger-model";
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

  it("avec mensualité empreinte : affiche crédit conservé + nouveau prêt rachat", () => {
    const keep = derived.lastResult?.scenarios.find((s) => s.scenario === "keep_a");
    expect(keep?.keepFinancingMode).toBe("keep_existing_loan");

    const ledger = buildLabLedger({
      doorId: "keep_a",
      footprint,
      assumptions: defaultAssumptions(),
      lab: baseState.lab,
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    expect(ledger?.lines.some((l) => l.id === "kept-mortgage")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "new-loan")).toBe(true);
    expect(ledger?.lines.find((l) => l.id === "kept-mortgage")?.amount).toBe(950);
    expect(ledger?.footer).toMatch(/désolidarisation|banque/i);
    expect(ledger?.footer).toMatch(/endettement sera de \d+ %/);
    expect(ledger?.footer).toMatch(/Projet finançable|limite bancaire de 35 %/);
    expect(ledger?.footer).not.toMatch(/capacité max/i);
    expect(ledger?.footer).not.toMatch(/effort de 0/);
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

  it("keep_a : affiche capital du partant et cible de relogement", () => {
    const ledger = buildLabLedger({
      doorId: "keep_a",
      footprint,
      assumptions: defaultAssumptions(),
      lab: { ...defaultLabState(), activeDoor: "keep_a" },
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    expect(ledger?.lines.some((l) => l.id === "departure-capital")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "relocate-target")).toBe(true);
    expect(ledger?.footer).toMatch(/Relogement du partant/i);
  });

  it("keep_a + occupation : impute l'indemnité sur le rachat", () => {
    const lab = {
      ...defaultLabState(),
      activeDoor: "keep_a" as const,
      enabledLevers: ["occupation_indemnity" as const],
      overrides: { occupation_indemnity: { occupationMonths: 8 } },
    };
    const withOcc = recomputeSeparationDerived({ ...baseState, lab });
    const keep = withOcc.lastResult?.scenarios.find((s) => s.scenario === "keep_a");
    expect(keep?.occupationIndemnity?.amount).toBeGreaterThan(0);

    const ledger = buildLabLedger({
      doorId: "keep_a",
      footprint,
      assumptions: defaultAssumptions(),
      lab,
      result: withOcc.lastResult,
      doorVerdicts: withOcc.doorVerdicts,
    });
    expect(ledger?.lines.some((l) => l.id === "occupation-indemnity")).toBe(true);
    expect(ledger?.lines.find((l) => l.id === "occupation-indemnity")?.amount).toBe(
      keep?.occupationIndemnity?.amount
    );
    expect(ledger?.lines.some((l) => l.id === "buyout-transfer")).toBe(true);
  });

  it("rent_out : décompose loyer − crédit − TF/charges − impôts = cashflow net", () => {
    const ledger = buildLabLedger({
      doorId: "rent_out",
      footprint,
      assumptions: defaultAssumptions(),
      lab: { ...defaultLabState(), activeDoor: "rent_out" },
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    expect(ledger?.lines.some((l) => l.id === "rent")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "vacancy")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "property-tax")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "pno")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "management")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "tax")).toBe(true);
    expect(ledger?.lines.find((l) => l.id === "net")?.label).toMatch(/Cashflow net/i);
    expect(ledger?.footer).toMatch(/micro-foncier|Feu/i);
    const rentScenario = derived.lastResult?.scenarios.find((s) => s.scenario === "rent_out");
    expect(ledger?.lines.find((l) => l.id === "net")?.amount).toBe(
      Math.round(rentScenario?.rentOutBreakdown?.netCashflow.amount ?? NaN)
    );
  });
});
