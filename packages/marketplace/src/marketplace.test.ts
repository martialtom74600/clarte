import { describe, it, expect } from "vitest";
import {
  buildMarketplaceLead,
  getCreditPrice,
  maskPostalCode,
  isLeadSellable,
  buildLeadContact,
} from "../src/index.js";

describe("marketplace", () => {
  it("masque le code postal", () => {
    expect(maskPostalCode("75011")).toBe("750**");
  });

  it("refuse un lead sans téléphone pour le marketplace", () => {
    expect(isLeadSellable(buildLeadContact({ email: "a@b.com", phone: null, simulationSummary: {} }))).toBe(false);
    expect(isLeadSellable(buildLeadContact({ email: "a@b.com", phone: "0612345678", simulationSummary: {} }))).toBe(true);
  });

  it("calcule le prix crédit selon tier", () => {
    expect(getCreditPrice("hot", true)).toBe(3);
    expect(getCreditPrice("hot", false)).toBe(2);
  });

  it("ne liste pas sans opt-in partenaire", () => {
    const lead = buildMarketplaceLead({
      email: "test@example.com",
      phone: "0612345678",
      postalCode: "75011",
      optInPartnerMatch: false,
      leadScore: { score: 80, tier: "hot", recommendedPartners: ["notaire"], qualifiesForCpl: true },
      simulation: {
        status: "marriage",
        persons: [{ id: "A" }, { id: "B" }],
        assets: [{ id: "h", type: "real_estate", label: "Maison", grossValue: { amount: 400000, currency: "EUR" }, ownership: { kind: "community" } }],
        liabilities: [],
        options: { scenario: "sell" },
      },
      result: {
        netWorthByPerson: { A: { amount: 200000, currency: "EUR" }, B: { amount: 200000, currency: "EUR" } },
        scenarios: [],
        complexityScore: 65,
        warnings: [],
        disclaimers: [],
        rulePackVersion: "2026.1",
      },
    });
    expect(lead).toBeNull();
  });
});
