import { describe, it, expect } from "vitest";
import { runSimulation, eur, getNetAssetValue } from "../src/index.js";
import type { SimulationInput } from "@separation/schemas";

const basePersons: SimulationInput["persons"] = [
  { id: "A", name: "Alice" },
  { id: "B", name: "Bob" },
];

function createConcubinageInput(
  overrides: Partial<SimulationInput> = {}
): SimulationInput {
  return {
    status: "concubinage",
    persons: basePersons,
    assets: [
      {
        id: "house",
        type: "real_estate",
        label: "Appartement Paris",
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
    options: {
      primaryResidenceId: "house",
      scenario: "compare_all",
    },
    ...overrides,
  };
}

describe("runSimulation - concubinage", () => {
  it("calcule la valeur nette du bien immobilier", () => {
    const input = createConcubinageInput();
    const asset = input.assets[0];
    const net = getNetAssetValue(asset, input.liabilities);
    expect(net.amount).toBe(200000);
  });

  it("calcule une soulte 50/50 quand A rachète", () => {
    const input = createConcubinageInput({
      options: { primaryResidenceId: "house", scenario: "keep_a" },
    });
    const result = runSimulation(input);
    expect(result.soulte?.amount.amount).toBe(100000);
    expect(result.soulte?.payer).toBe("A");
    expect(result.soulte?.receiver).toBe("B");
  });

  it("ajuste la soulte avec apports asymétriques", () => {
    const input = createConcubinageInput({
      contributionA: 20000,
      contributionB: 30000,
      options: { primaryResidenceId: "house", scenario: "keep_a" },
    });
    const result = runSimulation(input);
    expect(result.soulte?.amount.amount).toBe(120000);
  });

  it("calcule la mensualité sur CRD + soulte + frais (pas soulte seule)", () => {
    const input = createConcubinageInput({
      options: {
        primaryResidenceId: "house",
        scenario: "keep_a",
        mortgageRate: 0.0385,
        mortgageDurationYears: 20,
      },
    });
    const result = runSimulation(input);
    const keep = result.scenarios.find((s) => s.scenario === "keep_a")!;
    const refinance = keep.soulte!.refinanceAmount!.amount;
    expect(refinance).toBeGreaterThan(keep.soulte!.amount.amount);
    expect(refinance).toBe(
      200000 + keep.soulte!.amount.amount + keep.soulte!.notaryFeesEstimate!.amount
    );
    expect(keep.keepFinancingMode).toBe("full_refinance");
    expect(keep.cashNeeded?.amount).toBe(refinance);
    expect(keep.monthlyPaymentEstimate!.amount).toBeGreaterThan(1000);
  });

  it("avec mensualité historique : conserve le CRD et ne refinance que le rachat", () => {
    const input = createConcubinageInput({
      monthlyMortgagePayment: 900,
      options: {
        primaryResidenceId: "house",
        scenario: "keep_a",
        mortgageRate: 0.0385,
        mortgageDurationYears: 20,
      },
    });
    const result = runSimulation(input);
    const keep = result.scenarios.find((s) => s.scenario === "keep_a")!;
    expect(keep.keepFinancingMode).toBe("keep_existing_loan");
    expect(keep.keptMortgageMonthly?.amount).toBe(900);
    expect(keep.newLoanAmount?.amount).toBe(keep.soulte!.totalCashNeeded!.amount);
    expect(keep.newLoanAmount!.amount).toBeLessThan(keep.soulte!.refinanceAmount!.amount);
    expect(keep.monthlyPaymentEstimate!.amount).toBe(
      900 + keep.newLoanMonthly!.amount
    );
  });

  it("compare les 3 scénarios", () => {
    const result = runSimulation(createConcubinageInput());
    expect(result.scenarios).toHaveLength(4);
    expect(result.scenarios.map((s) => s.scenario)).toEqual([
      "keep_a",
      "keep_b",
      "sell",
      "rent_out",
    ]);
  });

  it("répartit équitablement en cas de vente", () => {
    const input = createConcubinageInput({
      options: { primaryResidenceId: "house", scenario: "sell" },
    });
    const result = runSimulation(input);
    const sellScenario = result.scenarios[0];
    expect(sellScenario.netWorthByPerson.A.amount).toBe(100000);
    expect(sellScenario.netWorthByPerson.B.amount).toBe(100000);
  });
});

describe("runSimulation - mariage communauté légale", () => {
  it("attribue 50% de la masse commune à chaque époux", () => {
    const input: SimulationInput = {
      status: "marriage",
      marriageRegime: "communaute_legale",
      marriageDate: "2015-06-01",
      persons: basePersons,
      assets: [
        {
          id: "house",
          type: "real_estate",
          label: "Maison",
          grossValue: eur(300000),
          ownership: { kind: "community" },
          isPrimaryResidence: true,
        },
        {
          id: "savings-a",
          type: "savings",
          label: "Livret A Alice",
          grossValue: eur(20000),
          ownership: { kind: "own", owner: "A" },
        },
      ],
      liabilities: [],
      options: { primaryResidenceId: "house", scenario: "compare_all" },
    };

    const result = runSimulation(input);
    expect(result.netWorthByPerson.A.amount).toBe(170000);
    expect(result.netWorthByPerson.B.amount).toBe(150000);
  });
});

describe("runSimulation - PACS", () => {
  it("traite les biens communs déclarés en 50/50", () => {
    const input: SimulationInput = {
      status: "pacs",
      pacsDate: "2020-01-01",
      persons: basePersons,
      assets: [
        {
          id: "joint-savings",
          type: "savings",
          label: "Compte joint",
          grossValue: eur(10000),
          ownership: { kind: "community" },
        },
        {
          id: "car-b",
          type: "vehicle",
          label: "Voiture Bob",
          grossValue: eur(15000),
          ownership: { kind: "own", owner: "B" },
        },
      ],
      liabilities: [],
      options: { scenario: "compare_all" },
    };

    const result = runSimulation(input);
    expect(result.netWorthByPerson.A.amount).toBe(5000);
    expect(result.netWorthByPerson.B.amount).toBe(20000);
  });
});

describe("complexity score", () => {
  it("augmente avec enfants mineurs et patrimoine élevé", () => {
    const result = runSimulation(
      createConcubinageInput({
        hasMinorChildren: true,
        assets: [
          {
            id: "house",
            type: "real_estate",
            label: "Villa",
            grossValue: eur(600000),
            ownership: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
            isPrimaryResidence: true,
          },
        ],
        liabilities: [],
      })
    );
    expect(result.complexityScore).toBeGreaterThanOrEqual(45);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("communauté universelle", () => {
  it("répartit tout le patrimoine net 50/50", () => {
    const input: SimulationInput = {
      status: "marriage",
      marriageRegime: "communaute_universelle",
      persons: basePersons,
      assets: [
        {
          id: "house",
          type: "real_estate",
          label: "Maison",
          grossValue: eur(400000),
          ownership: { kind: "community" },
        },
        {
          id: "car",
          type: "vehicle",
          label: "Voiture",
          grossValue: eur(20000),
          ownership: { kind: "own", owner: "A" },
        },
      ],
      liabilities: [
        {
          id: "loan",
          type: "consumer_loan",
          remainingBalance: eur(40000),
          responsibility: { kind: "community" },
        },
      ],
      options: { scenario: "compare_all" },
    };

    const result = runSimulation(input);
    expect(result.netWorthByPerson.A.amount).toBe(190000);
    expect(result.netWorthByPerson.B.amount).toBe(190000);
  });
});
