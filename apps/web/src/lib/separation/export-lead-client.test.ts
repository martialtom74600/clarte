import { describe, it, expect } from "vitest";
import { buildLeadSimulationInput } from "@/lib/separation/export-lead-client";
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

describe("buildLeadSimulationInput", () => {
  it("retourne null sans porte active", () => {
    expect(
      buildLeadSimulationInput({
        footprint,
        assumptions: defaultAssumptions(),
        lab: defaultLabState(),
      })
    ).toBeNull();
  });

  it("fixe le scénario sur la porte laboratoire active", () => {
    const input = buildLeadSimulationInput({
      footprint,
      assumptions: defaultAssumptions(),
      lab: { ...defaultLabState(), activeDoor: "sell" },
    });
    expect(input?.options.scenario).toBe("sell");
    expect(input?.postalCode).toBe("75011");
  });
});
