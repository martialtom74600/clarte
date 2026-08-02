import { describe, it, expect } from "vitest";
import {
  compileSimulationInput,
  defaultAssumptions,
  defaultLabState,
  isFootprintComplete,
  seedLabFromFootprint,
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
  apportsDeclared: false,
  financementDeclared: false,
  completedAt: null,
};

function baseState(overrides: Partial<SeparationState> = {}): SeparationState {
  return {
    stratum: "empreinte",
    footprint: completeFootprint,
    assumptions: defaultAssumptions(),
    lab: defaultLabState(),
    marketBuy: null,
    marketRent: null,
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

describe("seedLabFromFootprint", () => {
  it("active apports + mensualité + relogement quand renseignés", () => {
    const lab = seedLabFromFootprint({
      ...completeFootprint,
      contributionA: 20000,
      contributionB: 10000,
    });
    expect(lab.enabledLevers).toEqual(
      expect.arrayContaining([
        "initial_contributions",
        "historical_mortgage_rate",
        "relocate_housing",
      ])
    );
    expect(lab.overrides.initial_contributions).toEqual({
      contributionA: 20000,
      contributionB: 10000,
    });
    expect(lab.overrides.historical_mortgage_rate?.monthlyMortgagePayment).toBe(950);
    expect(lab.overrides.relocate_housing?.marketTier).toBe("entry");
    expect(lab.overrides.relocate_housing?.surfaceSqm).toBeGreaterThan(0);
  });

  it("n'active pas le crédit si sans crédit", () => {
    const lab = seedLabFromFootprint({
      ...completeFootprint,
      mortgageRemaining: 0,
      monthlyMortgagePayment: 0,
      contributionA: 5000,
      contributionB: 0,
    });
    expect(lab.enabledLevers).toContain("initial_contributions");
    expect(lab.enabledLevers).toContain("relocate_housing");
    expect(lab.enabledLevers).not.toContain("historical_mortgage_rate");
  });
});

describe("isFootprintComplete", () => {
  it("exige surface, cadre juridique, crédit (mensualité + durée) et revenus", () => {
    expect(isFootprintComplete(completeFootprint)).toBe(true);
    expect(isFootprintComplete({ ...completeFootprint, incomeB: 0 })).toBe(false);
    expect(isFootprintComplete({ ...completeFootprint, postalCode: "750" })).toBe(false);
    expect(isFootprintComplete({ ...completeFootprint, propertySurface: 0 })).toBe(false);
    expect(isFootprintComplete({ ...completeFootprint, cadreJuridiqueDeclared: false })).toBe(
      false
    );
    expect(isFootprintComplete({ ...completeFootprint, legalStatus: "" })).toBe(false);
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
  it("injecte les prix zone DVF quand marketBuy correspond au CP", () => {
    const input = compileSimulationInput(
      baseState({
        marketBuy: {
          postalCode: "75011",
          medianPricePerSqm: 9800,
          minPricePerSqm: 8330,
          maxPricePerSqm: 12_250,
          source: "dvf",
          transactionCount: 40,
          fetchedAt: Date.now(),
        },
      })
    );
    expect(input.zoneMedianPricePerSqm).toBe(9800);
    expect(input.zoneMinPricePerSqm).toBe(8330);
    expect(input.zoneMaxPricePerSqm).toBe(12_250);
    expect(input.zonePriceSource).toBe("dvf");
  });

  it("injecte les loyers zone quand marketRent correspond au CP", () => {
    const input = compileSimulationInput(
      baseState({
        marketRent: {
          postalCode: "75011",
          communeCode: "75111",
          communeName: "Paris 11e",
          medianRentPerSqm: 31.72,
          minRentPerSqm: 25.17,
          maxRentPerSqm: 39.98,
          source: "carte_loyers",
          fetchedAt: Date.now(),
        },
      })
    );
    expect(input.zoneRentMedianPerSqm).toBe(31.72);
    expect(input.zoneRentMinPerSqm).toBe(25.17);
    expect(input.zoneRentMaxPerSqm).toBe(39.98);
    expect(input.zoneRentSource).toBe("carte_loyers");
  });

  it("compile l'empreinte avec hypothèses standard (concubinage 50/50)", () => {
    const input = compileSimulationInput(baseState());
    expect(input.status).toBe("concubinage");
    expect(input.postalCode).toBe("75011");
    expect(input.propertySurface).toBe(65);
    expect(input.monthlyMortgagePayment).toBe(950);
    expect(input.options.mortgageDurationYears).toBe(15);
    expect(input.assets[0]?.purchasePrice?.amount).toBe(320000);
    expect(input.contributionA).toBeUndefined();
    expect(input.contributionB).toBeUndefined();
    expect(input.zoneMedianPricePerSqm).toBeUndefined();
    expect(input.assets[0].ownership).toEqual({
      kind: "indivision",
      shares: { A: 0.5, B: 0.5 },
    });
    expect(input.options.scenario).toBe("compare_all");
  });

  it("utilise les quotes-parts de l'empreinte pour la soulte (ex. 60/40)", () => {
    const input = compileSimulationInput(
      baseState({
        footprint: {
          ...completeFootprint,
          legalStatus: "concubinage",
          ownershipShareA: 60,
          ownershipShareB: 40,
          cadreJuridiqueDeclared: true,
        },
        assumptions: {
          ...defaultAssumptions(),
          status: "concubinage",
          shareA: 50,
          shareB: 50,
        },
      })
    );
    expect(input.assets[0].ownership).toEqual({
      kind: "indivision",
      shares: { A: 0.6, B: 0.4 },
    });
    const derived = recomputeSeparationDerived(
      baseState({
        footprint: {
          ...completeFootprint,
          legalStatus: "concubinage",
          ownershipShareA: 60,
          ownershipShareB: 40,
          cadreJuridiqueDeclared: true,
        },
      })
    );
    const soulte = derived.lastResult?.scenarios.find((s) => s.scenario === "keep_a")?.soulte
      ?.amount.amount;
    // Net 200 k€ (400 k − 200 k CRD) · part B 40 % → soulte 80 k€ (vs 100 k€ en 50/50)
    expect(soulte).toBe(80_000);
  });

  it("mariage + parts d'acte + apports : créance 90k (pas récompense communauté)", () => {
    const derived = recomputeSeparationDerived(
      baseState({
        footprint: {
          ...completeFootprint,
          legalStatus: "marriage",
          ownershipShareA: 60,
          ownershipShareB: 40,
          cadreJuridiqueDeclared: true,
          contributionA: 20000,
          contributionB: 30000,
          purchasePrice: 320000,
          completedAt: "2026-01-01T00:00:00.000Z",
        },
        assumptions: {
          ...defaultAssumptions(),
          status: "marriage",
          marriageRegime: "communaute_legale",
          shareA: 60,
          shareB: 40,
        },
      })
    );
    const keepA = derived.lastResult?.scenarios.find((s) => s.scenario === "keep_a")?.soulte;
    expect(keepA?.contributionMode).toBe("creance");
    // Net 200k − 50k créances = 150k · part B 40 % + 30k = 90k
    expect(keepA?.amount.amount).toBe(90_000);
  });

  it("utilise les parts de l'acte même pour un couple marié (60/40)", () => {
    const input = compileSimulationInput(
      baseState({
        footprint: {
          ...completeFootprint,
          legalStatus: "marriage",
          ownershipShareA: 60,
          ownershipShareB: 40,
          cadreJuridiqueDeclared: true,
        },
        assumptions: {
          ...defaultAssumptions(),
          status: "marriage",
          marriageRegime: "communaute_legale",
          shareA: 50,
          shareB: 50,
        },
      })
    );
    expect(input.assets[0].ownership).toEqual({
      kind: "indivision",
      shares: { A: 0.6, B: 0.4 },
    });
    expect(input.liabilities[0]?.responsibility).toEqual({
      kind: "indivision",
      shares: { A: 0.6, B: 0.4 },
    });
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

  it("injecte les apports depuis l'empreinte une fois le wizard terminé", () => {
    const input = compileSimulationInput(
      baseState({
        footprint: {
          ...completeFootprint,
          contributionA: 20000,
          contributionB: 30000,
          completedAt: "2026-01-01T00:00:00.000Z",
        },
      })
    );
    expect(input.contributionA).toBe(20000);
    expect(input.contributionB).toBe(30000);
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
    expect(derived.lastResult?.scenarios).toHaveLength(5);
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
    expect(apportsSoulte).toBe(105000);
  });
});
