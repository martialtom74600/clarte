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

  it("Cas 3: vente avec agence 5 % + diagnostics → 89,1k chacun", () => {
    const input: SimulationInput = {
      status: "concubinage",
      persons,
      assets: [{
        id: "house", type: "real_estate", label: "Appart", grossValue: eur(400000),
        ownership: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
        isPrimaryResidence: true,
        linkedLiabilityIds: ["mortgage"],
      }],
      liabilities: [{
        id: "mortgage", type: "mortgage", remainingBalance: eur(200000),
        responsibility: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
        linkedAssetId: "house",
      }],
      options: { primaryResidenceId: "house", scenario: "sell" },
      postalCode: "75011",
      propertySurface: 65,
    };
    const result = runSimulation(input);
    const sell = result.scenarios[0];
    expect(sell.agencyFeesEstimate?.amount).toBe(20000);
    expect(sell.diagnosticsEstimate?.amount).toBe(1800);
    expect(sell.saleNetProceeds?.amount).toBe(178200);
    expect(sell.saleProceedsByPerson?.A.amount).toBe(89100);
    expect(sell.saleProceedsByPerson?.B.amount).toBe(89100);
    expect(sell.primaryResidenceExempt).toBe(true);
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

  it("Cas 8: droit de partage 2,5 % + émoluments 1,5 % sur actif net (concubinage)", () => {
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
      },
    };
    const result = runSimulation(input);
    // net 200k, soulte 100k ; frais = 200k × (2,5 % + 1,5 %) = 8 000
    expect(result.soulte?.amount.amount).toBe(100000);
    expect(result.soulte?.droitDePartage?.amount).toBe(5000);
    expect(result.soulte?.emolumentsEstimate?.amount).toBe(3000);
    expect(result.soulte?.totalCashNeeded?.amount).toBe(108000);
    expect(result.soulte?.refinanceAmount?.amount).toBe(108000);
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
