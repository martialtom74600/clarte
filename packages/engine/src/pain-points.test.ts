import { describe, it, expect } from "vitest";
import {
  estimateChildSupport,
  analyzePatrimonyImbalance,
  compareResolutionPaths,
  computePostSeparationCashflow,
  compareMediationInputs,
} from "../src/index.js";

describe("estimateChildSupport — barème Justice 2026", () => {
  it("applique (revenu − 652) × 13,5 % pour 1 enfant garde classique", () => {
    const result = estimateChildSupport({
      payerIncomeMonthly: 3000,
      recipientIncomeMonthly: 1500,
      numberOfChildren: 1,
      custodyType: "classic",
    });
    // (3000 − 652) × 0.135 = 316.98 → 316.98
    expect(result?.monthlyAmount.amount).toBe(316.98);
    expect(result?.availableIncome).toBe(2348);
  });

  it("utilise le taux dégressif pour 2 enfants (11,5 %, pas 23 %)", () => {
    const result = estimateChildSupport({
      payerIncomeMonthly: 5000,
      recipientIncomeMonthly: 2000,
      numberOfChildren: 2,
      custodyType: "classic",
    });
    // (5000 − 652) × 0.115 = 500.02
    expect(result?.monthlyAmount.amount).toBe(500.02);
    expect(result?.percentageApplied).toBeCloseTo(11.5);
  });

  it("réduit le montant en garde alternée (9 %)", () => {
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
    expect(alternate!.percentageApplied).toBeCloseTo(9);
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
