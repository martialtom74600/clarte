import { describe, it, expect } from "vitest";
import {
  compileSimulationInput,
  defaultAssumptions,
  defaultLabState,
  isFootprintComplete,
} from "@/lib/separation/compile-simulation-input";
import { recomputeSeparationDerived } from "@/lib/separation/recompute-derived";
import type { FootprintState, SeparationState } from "@/lib/separation/separation-types";

const completeFootprint: FootprintState = {
  postalCode: "75011",
  propertyValue: 400000,
  propertySurface: 65,
  purchasePrice: 320000,
  mortgageRemaining: 200000,
  monthlyMortgagePayment: 950,
  mortgageRemainingYears: 15,
  incomeA: 5000,
  incomeB: 4000,
  completedAt: null,
};

function baseState(overrides: Partial<SeparationState> = {}): SeparationState {
  return {
    stratum: "empreinte",
    footprint: completeFootprint,
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

describe("isFootprintComplete", () => {
  it("exige surface, crédit (mensualité + durée) et revenus", () => {
    expect(isFootprintComplete(completeFootprint)).toBe(true);
    expect(isFootprintComplete({ ...completeFootprint, incomeB: 0 })).toBe(false);
    expect(isFootprintComplete({ ...completeFootprint, postalCode: "750" })).toBe(false);
    expect(isFootprintComplete({ ...completeFootprint, propertySurface: 0 })).toBe(false);
    expect(isFootprintComplete({ ...completeFootprint, monthlyMortgagePayment: 0 })).toBe(
      false
    );
    expect(isFootprintComplete({ ...completeFootprint, mortgageRemainingYears: 0 })).toBe(
      false
    );
    expect(
      isFootprintComplete({
        ...completeFootprint,
        mortgageRemaining: 0,
        monthlyMortgagePayment: 0,
        mortgageRemainingYears: 0,
      })
    ).toBe(true);
  });
});

describe("compileSimulationInput", () => {
  it("compile l'empreinte avec hypothèses standard (concubinage 50/50)", () => {
    const input = compileSimulationInput(baseState());
    expect(input.status).toBe("concubinage");
    expect(input.postalCode).toBe("75011");
    expect(input.propertySurface).toBe(65);
    expect(input.monthlyMortgagePayment).toBe(950);
    expect(input.options.mortgageDurationYears).toBe(15);
    expect(input.assets[0]?.purchasePrice?.amount).toBe(320000);
    expect(input.contributionA).toBeUndefined();
    expect(input.assets[0].ownership).toEqual({
      kind: "indivision",
      shares: { A: 0.5, B: 0.5 },
    });
    expect(input.options.scenario).toBe("compare_all");
  });

  it("laisse le levier mensualité écraser l'empreinte", () => {
    const input = compileSimulationInput(
      baseState({
        lab: {
          activeDoor: "keep_a",
          enabledLevers: ["historical_mortgage_rate"],
          overrides: {
            historical_mortgage_rate: { monthlyMortgagePayment: 1100 },
          },
        },
      })
    );
    expect(input.monthlyMortgagePayment).toBe(1100);
    expect(input.options.mortgageDurationYears).toBe(15);
  });

  it("injecte les apports uniquement quand le levier est activé", () => {
    const withoutLever = compileSimulationInput(baseState());
    expect(withoutLever.contributionA).toBeUndefined();

    const withLever = compileSimulationInput(
      baseState({
        lab: {
          activeDoor: "keep_a",
          enabledLevers: ["initial_contributions"],
          overrides: {
            initial_contributions: { contributionA: 20000, contributionB: 30000 },
          },
        },
      })
    );
    expect(withLever.contributionA).toBe(20000);
    expect(withLever.contributionB).toBe(30000);
  });

  it("injecte la mensualité historique via levier (sans écraser le taux marché du nouveau prêt)", () => {
    const input = compileSimulationInput(
      baseState({
        lab: {
          activeDoor: "rent_out",
          enabledLevers: ["historical_mortgage_rate"],
          overrides: {
            historical_mortgage_rate: { monthlyMortgagePayment: 950 },
          },
        },
      })
    );
    expect(input.monthlyMortgagePayment).toBe(950);
    expect(input.options.mortgageRate).toBe(defaultAssumptions().mortgageRate);
  });

  it("injecte enfants seulement si le levier est actif avec enfants", () => {
    const off = compileSimulationInput(
      baseState({
        lab: {
          activeDoor: "keep_a",
          enabledLevers: ["children_impact"],
          overrides: {
            children_impact: {
              hasMinorChildren: false,
              numberOfChildren: 0,
              custodyType: "classic",
            },
          },
        },
      })
    );
    expect(off.hasMinorChildren).toBe(false);
    expect(off.numberOfChildren).toBeUndefined();

    const on = compileSimulationInput(
      baseState({
        lab: {
          activeDoor: "keep_a",
          enabledLevers: ["children_impact"],
          overrides: {
            children_impact: {
              hasMinorChildren: true,
              numberOfChildren: 2,
              custodyType: "alternate",
            },
          },
        },
      })
    );
    expect(on.hasMinorChildren).toBe(true);
    expect(on.numberOfChildren).toBe(2);
    expect(on.custodyType).toBe("alternate");
  });

  it("ignore les overrides si le levier n'est pas activé", () => {
    const input = compileSimulationInput(
      baseState({
        lab: {
          activeDoor: null,
          enabledLevers: [],
          overrides: {
            initial_contributions: { contributionA: 20000, contributionB: 30000 },
          },
        },
      })
    );
    expect(input.contributionA).toBeUndefined();
  });
});

describe("recomputeSeparationDerived", () => {
  it("produit result + 4 verdicts quand empreinte complète", () => {
    const derived = recomputeSeparationDerived(baseState());
    expect(derived.lastInput).not.toBeNull();
    expect(derived.lastResult?.scenarios).toHaveLength(4);
    expect(derived.doorVerdicts?.keep_a.verdict).toBeDefined();
    expect(derived.doorVerdicts?.rent_out.verdict).toBeDefined();
    expect(derived.computedAt).not.toBeNull();
  });

  it("retourne null si empreinte incomplète", () => {
    const derived = recomputeSeparationDerived(
      baseState({ footprint: { ...completeFootprint, propertyValue: 0 } })
    );
    expect(derived.lastResult).toBeNull();
    expect(derived.doorVerdicts).toBeNull();
  });

  it("recalcule la soulte quand les apports sont injectés", () => {
    const base = recomputeSeparationDerived(baseState());
    const withApports = recomputeSeparationDerived(
      baseState({
        lab: {
          activeDoor: "keep_a",
          enabledLevers: ["initial_contributions"],
          overrides: {
            initial_contributions: { contributionA: 20000, contributionB: 30000 },
          },
        },
      })
    );
    const baseSoulte = base.lastResult?.scenarios.find((s) => s.scenario === "keep_a")?.soulte
      ?.amount.amount;
    const apportsSoulte = withApports.lastResult?.scenarios.find((s) => s.scenario === "keep_a")
      ?.soulte?.amount.amount;
    expect(apportsSoulte).toBeGreaterThan(baseSoulte!);
    expect(apportsSoulte).toBe(120000);
  });
});
