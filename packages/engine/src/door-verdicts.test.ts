import { describe, it, expect } from "vitest";
import { compileDoorVerdicts, runSimulation, eur } from "../src/index.js";
import type { SimulationInput } from "@separation/schemas";

function createInput(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    status: "concubinage",
    persons: [
      { id: "A", income: eur(5000) },
      { id: "B", income: eur(4000) },
    ],
    assets: [
      {
        id: "house",
        type: "real_estate",
        label: "Appartement",
        grossValue: eur(400000),
        ownership: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
        isPrimaryResidence: true,
        linkedLiabilityIds: ["mortgage"],
      },
    ],
    liabilities: [
      {
        id: "mortgage",
        type: "mortgage",
        remainingBalance: eur(200000),
        responsibility: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
        linkedAssetId: "house",
      },
    ],
    options: { primaryResidenceId: "house", scenario: "compare_all" },
    postalCode: "75011",
    propertySurface: 65,
    ...overrides,
  };
}

describe("compileDoorVerdicts", () => {
  it("retourne un verdict pour chaque porte", () => {
    const input = createInput();
    const result = runSimulation(input);
    const verdicts = compileDoorVerdicts(input, result);

    expect(Object.keys(verdicts)).toEqual(["keep_a", "keep_b", "sell", "rent_out"]);
    expect(verdicts.keep_a.doorId).toBe("keep_a");
    expect(verdicts.keep_b.doorId).toBe("keep_b");
    expect(["green", "orange", "red"]).toContain(verdicts.keep_a.verdict);
    expect(verdicts.keep_a.label).toBe("Vous rachetez");
    expect(verdicts.rent_out.label).toBe("Garder et louer");
  });

  it("passe rent_out au rouge quand le crédit dépasse le loyer", () => {
    const input = createInput({
      monthlyMortgagePayment: 5000,
      postalCode: "75011",
      propertySurface: 30,
    });
    const result = runSimulation(input);
    const verdicts = compileDoorVerdicts(input, result);
    expect(verdicts.rent_out.verdict).toBe("red");
  });

  it("reflete une soulte plus élevée dans le détail keep_a avec apports", () => {
    const base = createInput();
    const withApports = createInput({ contributionA: 20000, contributionB: 30000 });
    const baseScenario = runSimulation(base).scenarios.find((s) => s.scenario === "keep_a");
    const apportsScenario = runSimulation(withApports).scenarios.find(
      (s) => s.scenario === "keep_a"
    );
    const baseVerdict = compileDoorVerdicts(base, runSimulation(base)).keep_a;
    const apportsVerdict = compileDoorVerdicts(withApports, runSimulation(withApports)).keep_a;

    expect(apportsScenario!.soulte!.amount.amount).toBeGreaterThan(
      baseScenario!.soulte!.amount.amount
    );
    expect(apportsScenario!.soulte!.amount.amount).toBe(105000);
    expect(baseVerdict.headline).toBeDefined();
    expect(apportsVerdict.detail).toContain("€");
  });
});

describe("runSimulation rent_out dynamique", () => {
  it("utilise le code postal et la surface pour estimer le loyer", () => {
    const paris = runSimulation(createInput({ postalCode: "75011", propertySurface: 65 }));
    const province = runSimulation(createInput({ postalCode: "33000", propertySurface: 65 }));

    const parisRent = paris.scenarios.find((s) => s.scenario === "rent_out");
    const provinceRent = province.scenarios.find((s) => s.scenario === "rent_out");

    expect(parisRent!.monthlyPaymentEstimate!.amount).toBeGreaterThan(
      provinceRent!.monthlyPaymentEstimate!.amount
    );
    expect(parisRent!.description).toContain("75011");
  });

  it("respecte monthlyMortgagePayment quand fourni", () => {
    const low = runSimulation(createInput({ monthlyMortgagePayment: 800 }));
    const high = runSimulation(createInput({ monthlyMortgagePayment: 3000 }));
    const lowRent = low.scenarios.find((s) => s.scenario === "rent_out")!;
    const highRent = high.scenarios.find((s) => s.scenario === "rent_out")!;
    expect(lowRent.monthlyPaymentEstimate!.amount).toBeGreaterThan(
      highRent.monthlyPaymentEstimate!.amount
    );
  });
});
