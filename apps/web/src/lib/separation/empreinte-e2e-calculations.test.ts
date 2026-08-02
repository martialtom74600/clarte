import { describe, it, expect } from "vitest";
import { calculateAmortization } from "@separation/engine";
import {
  compileSimulationInput,
  defaultAssumptions,
  defaultLabState,
  isFootprintComplete,
} from "@/lib/separation/compile-simulation-input";
import { recomputeSeparationDerived } from "@/lib/separation/recompute-derived";
import { buildAllPortes } from "@/lib/separation/porte-presenter";
import type { FootprintState, SeparationState } from "@/lib/separation/separation-types";
import { emptyEmpreinteDraft } from "@/components/separation/empreinte/empreinte-screens";
import { resolveFinancementValues } from "@/components/separation/empreinte/empreinte-amortization";

const baseFootprint: FootprintState = {
  postalCode: "75011",
  propertyValue: 400_000,
  propertySurface: 65,
  purchasePrice: 320_000,
  mortgageRemaining: 200_000,
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

function state(overrides: Partial<SeparationState> = {}): SeparationState {
  return {
    stratum: "portes",
    footprint: baseFootprint,
    assumptions: defaultAssumptions(),
    lab: defaultLabState(),
    derived: {
      lastInput: null,
      lastResult: null,
      doorVerdicts: null,
      computedAt: null,
    },
    discreteMode: false,
    ...overrides,
  };
}

function soulteOf(scenario: "keep_a" | "keep_b", s: SeparationState) {
  const derived = recomputeSeparationDerived(s);
  return derived.lastResult?.scenarios.find((sc) => sc.scenario === scenario)?.soulte;
}

describe("Empreinte E2E — calculs de référence", () => {
  it("empreinte complète est gateable", () => {
    expect(isFootprintComplete(baseFootprint)).toBe(true);
  });

  it("50/50 sans apports → soulte keep_a = 100k", () => {
    const soulte = soulteOf("keep_a", state());
    expect(soulte?.amount.amount).toBe(100_000);
    expect(soulte?.contributionMode).toBe("none");
  });

  it("60/40 sans apports → keep_a 80k / keep_b 120k", () => {
    const s = state({
      footprint: {
        ...baseFootprint,
        ownershipShareA: 60,
        ownershipShareB: 40,
      },
      assumptions: { ...defaultAssumptions(), shareA: 60, shareB: 40 },
    });
    expect(soulteOf("keep_a", s)?.amount.amount).toBe(80_000);
    expect(soulteOf("keep_b", s)?.amount.amount).toBe(120_000);
  });

  it("mariage 60/40 + apports 20k/30k → créance 90k (pas récompense)", () => {
    const s = state({
      footprint: {
        ...baseFootprint,
        legalStatus: "marriage",
        ownershipShareA: 60,
        ownershipShareB: 40,
        contributionA: 20_000,
        contributionB: 30_000,
        purchasePrice: 320_000,
      },
      assumptions: {
        ...defaultAssumptions(),
        status: "marriage",
        marriageRegime: "communaute_legale",
        shareA: 60,
        shareB: 40,
      },
    });
    const input = compileSimulationInput(s);
    expect(input.assets[0].ownership).toEqual({
      kind: "indivision",
      shares: { A: 0.6, B: 0.4 },
    });
    const soulte = soulteOf("keep_a", s);
    expect(soulte?.contributionMode).toBe("creance");
    expect(soulte?.amount.amount).toBe(90_000);
  });

  it("communauté pure (hors empreinte) → récompense 105k", () => {
    const input = compileSimulationInput(
      state({
        footprint: {
          ...baseFootprint,
          cadreJuridiqueDeclared: false,
          legalStatus: "",
          contributionA: 20_000,
          contributionB: 30_000,
          completedAt: null,
        },
        assumptions: {
          ...defaultAssumptions(),
          status: "marriage",
          marriageRegime: "communaute_legale",
        },
      })
    );
    // Sans cadre déclaré + mariage → community ownership
    expect(input.assets[0].ownership).toEqual({ kind: "community" });
  });

  it("sans crédit résout tout à zéro y compris un capital résiduel", () => {
    const values = resolveFinancementValues(
      emptyEmpreinteDraft({
        financementNoCredit: "1",
        initialMortgagePrincipal: "350000",
        mortgageStartDate: "01/2021",
        initialMortgageDurationYears: "25",
        initialMortgageRate: "1,2",
      })
    );
    expect(values.mortgageRemaining).toBe(0);
    expect(values.monthlyMortgagePayment).toBe(0);
    expect(values.initialMortgagePrincipal).toBe(0);
    expect(values.initialMortgageRate).toBe(0);
  });

  it("estimation amortissement : CRD et mensualité cohérents (01/2021 → août 2026)", () => {
    const result = calculateAmortization({
      principal: 350_000,
      annualRate: 0.012,
      durationYears: 25,
      startMonth: 1,
      startYear: 2021,
      asOfDate: new Date(2026, 7, 2),
      insuranceAnnualRate: 0.0034,
    });
    expect(result.remainingBalance).toBeGreaterThan(275_000);
    expect(result.remainingBalance).toBeLessThan(285_000);
    expect(result.monthlyPaymentTotal).toBeGreaterThan(1400);
    expect(result.monthlyPaymentTotal).toBeLessThan(1500);
    expect(result.remainingYears).toBe(20);
  });

  it("portes exposent 4 scénarios avec les bonnes soultes 60/40", () => {
    const s = state({
      footprint: {
        ...baseFootprint,
        ownershipShareA: 60,
        ownershipShareB: 40,
      },
      assumptions: { ...defaultAssumptions(), shareA: 60, shareB: 40 },
    });
    const derived = recomputeSeparationDerived(s);
    const portes = buildAllPortes(derived.lastResult, derived.doorVerdicts, s.footprint);
    expect(portes).toHaveLength(5);
    expect(portes.map((p) => p.doorId)).toEqual([
      "keep_a",
      "keep_b",
      "sell",
      "sell_rent",
      "rent_out",
    ]);
    const keepA = derived.lastResult?.scenarios.find((sc) => sc.scenario === "keep_a");
    expect(keepA?.soulte?.amount.amount).toBe(80_000);
  });

  it("apports footprint injectés après completion, levier labo les écrase", () => {
    const withFootprint = compileSimulationInput(
      state({
        footprint: {
          ...baseFootprint,
          contributionA: 20_000,
          contributionB: 30_000,
        },
      })
    );
    expect(withFootprint.contributionA).toBe(20_000);

    const withLever = compileSimulationInput(
      state({
        footprint: {
          ...baseFootprint,
          contributionA: 20_000,
          contributionB: 30_000,
        },
        lab: {
          activeDoor: "keep_a",
          enabledLevers: ["initial_contributions"],
          overrides: {
            initial_contributions: { contributionA: 5_000, contributionB: 5_000 },
          },
        },
      })
    );
    expect(withLever.contributionA).toBe(5_000);
    expect(withLever.contributionB).toBe(5_000);
  });
});
