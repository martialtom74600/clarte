import { describe, it, expect } from "vitest";
import {
  estimateChildSupport,
  analyzePatrimonyImbalance,
  compareResolutionPaths,
  computePostSeparationCashflow,
  compareMediationInputs,
} from "../src/index.js";

describe("estimateChildSupport", () => {
  it("calcule une pension indicative pour 1 enfant garde classique", () => {
    const result = estimateChildSupport({
      payerIncomeMonthly: 3000,
      recipientIncomeMonthly: 1500,
      numberOfChildren: 1,
      custodyType: "classic",
    });
    expect(result?.monthlyAmount.amount).toBe(405);
  });

  it("réduit le montant en garde alternée", () => {
    const classic = estimateChildSupport({
      payerIncomeMonthly: 3000,
      recipientIncomeMonthly: 1500,
      numberOfChildren: 1,
      custodyType: "classic",
    });
    const alternate = estimateChildSupport({
      payerIncomeMonthly: 3000,
      recipientIncomeMonthly: 1500,
      numberOfChildren: 1,
      custodyType: "alternate",
    });
    expect(alternate!.monthlyAmount.amount).toBeLessThan(classic!.monthlyAmount.amount);
  });
});

describe("analyzePatrimonyImbalance", () => {
  it("détecte un déséquilibre significatif", () => {
    const result = analyzePatrimonyImbalance(50000, 200000);
    expect(result?.suggestsCompensatoryAllowance).toBe(true);
    expect(result?.disadvantaged).toBe("A");
  });
});

describe("compareResolutionPaths", () => {
  it("montre des économies significatives à l'amiable", () => {
    const result = compareResolutionPaths(70);
    expect(result.savings.amount).toBeGreaterThan(0);
    expect(result.contentieux.estimatedMonths).toBeGreaterThan(result.amiable.estimatedMonths);
  });
});

describe("computePostSeparationCashflow", () => {
  it("simule une baisse de niveau de vie après vente", () => {
    const result = computePostSeparationCashflow({
      incomeAMonthly: 2500,
      incomeBMonthly: 2000,
      postalCode: "75011",
      scenario: "sell",
      numberOfChildren: 1,
      custodyType: "classic",
    });
    expect(result.householdAfter.amount).toBeLessThan(result.householdBefore.amount);
  });
});

describe("compareMediationInputs", () => {
  it("souligne les écarts entre deux versions", () => {
    const result = compareMediationInputs(
      { propertyValue: 400000, mortgageRemaining: 200000 },
      { propertyValue: 350000, mortgageRemaining: 200000 }
    );
    expect(result.diffs.length).toBeGreaterThan(0);
    expect(result.diffs[0].field).toBe("propertyValue");
  });
});
