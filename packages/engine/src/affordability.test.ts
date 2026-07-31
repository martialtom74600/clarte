import { describe, expect, it } from "vitest";
import { computeAffordability, computeNewLifeCap } from "./affordability.js";

describe("computeAffordability", () => {
  it("returns green when budget covers target with low effort", () => {
    const result = computeAffordability({
      incomeMonthly: 5000,
      liquidCapital: 150000,
      targetPropertyPrice: 350000,
    });
    expect(["green", "orange"]).toContain(result.verdict);
    expect(result.availableBudget.amount).toBeGreaterThan(0);
  });

  it("returns red when target far exceeds capacity", () => {
    const result = computeAffordability({
      incomeMonthly: 2000,
      liquidCapital: 10000,
      targetPropertyPrice: 800000,
    });
    expect(result.verdict).toBe("red");
    expect(result.gap.amount).toBeLessThan(0);
  });
});

describe("computeNewLifeCap", () => {
  it("returns four DoorId-aligned life path doors", () => {
    const result = computeNewLifeCap({
      postalCode: "75011",
      propertyValue: 400000,
      propertySurface: 65,
      mortgageRemaining: 180000,
      monthlyMortgagePayment: 950,
      contributionA: 40000,
      contributionB: 20000,
      incomeAMonthly: 4200,
      incomeBMonthly: 2800,
      netWorthA: 120000,
      netWorthB: 95000,
      intent: "keep_home",
      soulteAmount: 110000,
      soultePayer: "A",
    });

    expect(result.doors).toHaveLength(4);
    expect(result.doors.map((d) => d.id)).toEqual([
      "keep_a",
      "keep_b",
      "sell",
      "rent_out",
    ]);
    // 400k − 180k − 5%×400k − 1800 = 198 200
    expect(result.equityNet.amount).toBe(198200);
    expect(result.contributionsTotal.amount).toBe(60000);
    expect(["keep_a", "keep_b", "sell", "rent_out"]).toContain(result.recommendedDoorId);
  });
});
