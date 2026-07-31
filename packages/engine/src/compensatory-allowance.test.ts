import { describe, expect, it } from "vitest";
import { estimateCompensatoryAllowance } from "./compensatory-allowance.js";
import { runSimulation, eur } from "./index.js";
import type { SimulationInput } from "@separation/schemas";

describe("estimateCompensatoryAllowance", () => {
  it("ne s'applique pas hors mariage", () => {
    const result = estimateCompensatoryAllowance(
      {
        status: "concubinage",
        persons: [
          { id: "A", income: eur(5000) },
          { id: "B", income: eur(2000) },
        ],
        assets: [],
        liabilities: [],
        options: { scenario: "compare_all" },
      },
      200000,
      50000
    );
    expect(result).toBeNull();
  });

  it("estime un quantum en mariage avec écart de revenus", () => {
    const result = estimateCompensatoryAllowance(
      {
        status: "marriage",
        marriageRegime: "communaute_legale",
        marriageDate: "2014-01-01",
        persons: [
          { id: "A", income: eur(6000) },
          { id: "B", income: eur(2000) },
        ],
        assets: [],
        liabilities: [],
        options: { scenario: "compare_all" },
      },
      300000,
      80000
    );
    expect(result?.applicable).toBe(true);
    expect(result!.capitalEstimate.amount).toBeGreaterThan(0);
    expect(result!.note).toMatch(/270|271/);
  });
});

describe("runSimulation — prestation compensatoire", () => {
  it("surface la PC dans le résultat mariage", () => {
    const input: SimulationInput = {
      status: "marriage",
      marriageRegime: "communaute_legale",
      marriageDate: "2012-06-01",
      persons: [
        { id: "A", income: eur(7000) },
        { id: "B", income: eur(2200) },
      ],
      assets: [
        {
          id: "house",
          type: "real_estate",
          label: "Maison",
          grossValue: eur(450000),
          ownership: { kind: "community" },
          isPrimaryResidence: true,
        },
      ],
      liabilities: [],
      options: { primaryResidenceId: "house", scenario: "compare_all" },
    };
    const result = runSimulation(input);
    expect(result.compensatoryAllowance).toBeDefined();
    expect(result.warnings.some((w) => w.code === "COMPENSATORY_ALLOWANCE")).toBe(
      result.compensatoryAllowance?.applicable === true
    );
  });
});
