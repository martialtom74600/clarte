import { describe, it, expect } from "vitest";
import { scoreLead } from "../src/index.js";
import type { SimulationInput, SimulationResult } from "@separation/schemas";

const baseResult: SimulationResult = {
  netWorthByPerson: { A: { amount: 100000, currency: "EUR" }, B: { amount: 100000, currency: "EUR" } },
  scenarios: [],
  complexityScore: 65,
  warnings: [],
  disclaimers: [],
  rulePackVersion: "2026.1",
};

const baseSimulation: SimulationInput = {
  status: "concubinage",
  persons: [{ id: "A" }, { id: "B" }],
  assets: [
    {
      id: "house",
      type: "real_estate",
      label: "Maison",
      grossValue: { amount: 300000, currency: "EUR" },
      ownership: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
    },
  ],
  liabilities: [
    {
      id: "mortgage",
      type: "mortgage",
      remainingBalance: { amount: 100000, currency: "EUR" },
      responsibility: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
    },
  ],
  options: { scenario: "sell" },
};

describe("scoreLead", () => {
  it("qualifies hot lead with opt-in", () => {
    const score = scoreLead(
      {
        email: "test@example.com",
        propertyValue: 300000,
        optInPartnerMatch: true,
        scenarioPreference: "sell",
        urgencyMonths: 2,
      },
      baseSimulation,
      baseResult
    );

    expect(score.score).toBeGreaterThanOrEqual(55);
    expect(score.qualifiesForCpl).toBe(true);
    expect(score.recommendedPartners).toContain("agence");
  });

  it("does not qualify without opt-in", () => {
    const score = scoreLead(
      {
        email: "test@example.com",
        propertyValue: 300000,
        optInPartnerMatch: false,
      },
      baseSimulation,
      baseResult
    );

    expect(score.qualifiesForCpl).toBe(false);
  });
});
