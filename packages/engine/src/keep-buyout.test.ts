import { describe, expect, it } from "vitest";
import {
  computeKeepBilateralExtras,
  computeOccupationIndemnity,
  estimateGrossRentMonthly,
} from "./keep-buyout.js";
import { compileDoorVerdicts, runSimulation, eur } from "./index.js";
import { rentPerSqm } from "./market-rents.js";
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

describe("computeOccupationIndemnity", () => {
  it("calcule (loyer / 2) × mois", () => {
    // Paris 65 m² → 22 × 65 = 1430 → demi = 715 → × 8 = 5720
    const rent = rentPerSqm("75011") * 65;
    expect(rent).toBe(1430);
    expect(computeOccupationIndemnity(rent, 8)).toBe(5720);
    expect(computeOccupationIndemnity(rent, 0)).toBe(0);
  });
});

describe("computeKeepBilateralExtras", () => {
  it("expose capital partant + relogement zone", () => {
    const input = createInput();
    const result = runSimulation(input);
    const keep = result.scenarios.find((s) => s.scenario === "keep_a")!;
    const extras = computeKeepBilateralExtras(input, "A", keep.soulte!);

    expect(extras.departurePersonId).toBe("B");
    expect(extras.departureCapital.amount).toBe(keep.soulte!.amount.amount);
    expect(extras.relocateTarget.amount).toBeGreaterThan(0);
    expect(extras.departureRelocateVerdict).toMatch(/green|orange|red/);
    expect(extras.occupationIndemnity.amount).toBe(0);
  });

  it("impute l'indemnité d'occupation sur le capital du partant", () => {
    const input = createInput({
      options: {
        primaryResidenceId: "house",
        scenario: "compare_all",
        occupationMonths: 8,
      },
    });
    const result = runSimulation(input);
    const keep = result.scenarios.find((s) => s.scenario === "keep_a")!;
    const rent = estimateGrossRentMonthly(input);
    const expectedIndemnity = computeOccupationIndemnity(rent, 8);

    expect(keep.occupationMonths).toBe(8);
    expect(keep.occupationIndemnity?.amount).toBe(expectedIndemnity);
    expect(keep.departureCapital?.amount).toBe(
      keep.soulte!.amount.amount + expectedIndemnity
    );
    expect(keep.buyoutTransferTotal?.amount).toBe(
      keep.soulte!.amount.amount + expectedIndemnity
    );
    expect(keep.departurePersonId).toBe("B");
    expect(keep.relocateVerdictByPerson?.B).toBeDefined();
  });
});

describe("keep door verdict — viabilité croisée", () => {
  it("intègre le relogement du partant dans le feu keep_a", () => {
    const input = createInput();
    const result = runSimulation(input);
    const verdicts = compileDoorVerdicts(input, result);
    expect(verdicts.keep_a.detail).toMatch(/Partant|relogement/i);
    expect(["green", "orange", "red"]).toContain(verdicts.keep_a.verdict);
  });

  it("augmente le financement keep quand indemnité active", () => {
    const base = runSimulation(createInput());
    const withOcc = runSimulation(
      createInput({
        options: {
          primaryResidenceId: "house",
          scenario: "compare_all",
          occupationMonths: 8,
        },
      })
    );
    const baseKeep = base.scenarios.find((s) => s.scenario === "keep_a")!;
    const occKeep = withOcc.scenarios.find((s) => s.scenario === "keep_a")!;
    expect(occKeep.cashNeeded!.amount).toBeGreaterThan(baseKeep.cashNeeded!.amount);
    expect(occKeep.departureCapital!.amount).toBeGreaterThan(
      baseKeep.departureCapital!.amount
    );
  });
});
