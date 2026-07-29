import { describe, it, expect } from "vitest";
import { runSimulation, eur } from "../src/index.js";
import type { SimulationInput } from "@separation/schemas";

const persons: SimulationInput["persons"] = [{ id: "A" }, { id: "B" }];

describe("Legal test cases (notaire validation)", () => {
  it("Cas 1: concubinage 50/50 soulte 100k", () => {
    const input: SimulationInput = {
      status: "concubinage",
      persons,
      assets: [{
        id: "house", type: "real_estate", label: "Appart", grossValue: eur(400000),
        ownership: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
        linkedLiabilityIds: ["mortgage"],
      }],
      liabilities: [{
        id: "mortgage", type: "mortgage", remainingBalance: eur(200000),
        responsibility: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
        linkedAssetId: "house",
      }],
      options: { primaryResidenceId: "house", scenario: "keep_a" },
    };
    const result = runSimulation(input);
    expect(result.soulte?.amount.amount).toBe(100000);
  });

  it("Cas 2: concubinage 60/40 soulte 120k", () => {
    const input: SimulationInput = {
      status: "concubinage",
      persons,
      assets: [{
        id: "house", type: "real_estate", label: "Maison", grossValue: eur(300000),
        ownership: { kind: "indivision", shares: { A: 0.6, B: 0.4 } },
      }],
      liabilities: [],
      options: { primaryResidenceId: "house", scenario: "keep_a" },
    };
    const result = runSimulation(input);
    expect(result.soulte?.amount.amount).toBe(120000);
  });

  it("Cas 6: mariage séparation de biens soulte 150k", () => {
    const input: SimulationInput = {
      status: "marriage",
      marriageRegime: "separation_biens",
      persons,
      assets: [{
        id: "house", type: "real_estate", label: "Maison", grossValue: eur(400000),
        ownership: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
        linkedLiabilityIds: ["mortgage"],
      }],
      liabilities: [{
        id: "mortgage", type: "mortgage", remainingBalance: eur(100000),
        responsibility: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
        linkedAssetId: "house",
      }],
      options: { primaryResidenceId: "house", scenario: "keep_a" },
    };
    const result = runSimulation(input);
    expect(result.soulte?.amount.amount).toBe(150000);
  });

  it("Cas 8: soulte avec frais notaire 7.5%", () => {
    const input: SimulationInput = {
      status: "concubinage",
      persons,
      assets: [{
        id: "house", type: "real_estate", label: "Appart", grossValue: eur(200000),
        ownership: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
      }],
      liabilities: [],
      options: {
        primaryResidenceId: "house",
        scenario: "keep_a",
        notaryFeesRate: 0.075,
      },
    };
    const result = runSimulation(input);
    expect(result.soulte?.amount.amount).toBe(100000);
    expect(result.soulte?.totalCashNeeded?.amount).toBe(107500);
  });

  it("Cas 9: épargne propre et dettes perso", () => {
    const input: SimulationInput = {
      status: "concubinage",
      persons,
      assets: [
        {
          id: "house", type: "real_estate", label: "Maison", grossValue: eur(300000),
          ownership: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
        },
        {
          id: "savings-a", type: "savings", label: "Livret A", grossValue: eur(10000),
          ownership: { kind: "own", owner: "A" },
        },
      ],
      liabilities: [{
        id: "debt-b", type: "consumer_loan", remainingBalance: eur(5000),
        responsibility: { kind: "own", owner: "B" },
      }],
      options: { scenario: "compare_all" },
    };
    const result = runSimulation(input);
    expect(result.netWorthByPerson.A.amount).toBe(160000);
    expect(result.netWorthByPerson.B.amount).toBe(145000);
  });

  it("Cas 10: complexité élevée avec warnings", () => {
    const input: SimulationInput = {
      status: "marriage",
      marriageRegime: "communaute_legale",
      persons,
      hasMinorChildren: true,
      assets: [{
        id: "house", type: "real_estate", label: "Villa", grossValue: eur(600000),
        ownership: { kind: "own", owner: "A" },
      }],
      liabilities: [{
        id: "mortgage", type: "mortgage", remainingBalance: eur(100000),
        responsibility: { kind: "community" },
        linkedAssetId: "house",
      }],
      options: { scenario: "compare_all" },
    };
    const result = runSimulation(input);
    expect(result.complexityScore).toBeGreaterThanOrEqual(60);
    expect(result.warnings.some((w) => w.code === "MINOR_CHILDREN")).toBe(true);
    expect(result.warnings.some((w) => w.code === "HIGH_PATRIMONY")).toBe(true);
  });
});
