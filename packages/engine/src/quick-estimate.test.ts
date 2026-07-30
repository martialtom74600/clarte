import { describe, it, expect } from "vitest";
import { runQuickEstimate } from "./quick-estimate.js";

describe("runQuickEstimate", () => {
  it("calcule une fourchette de soulte pour concubinage 50/50", () => {
    const result = runQuickEstimate({
      status: "concubinage",
      intent: "keep_home",
      propertyValue: 400_000,
      mortgageRemaining: 200_000,
      shareA: 50,
      shareB: 50,
    });

    expect(result.midpoint.amount).toBe(100_000);
    expect(result.min.amount).toBeLessThanOrEqual(result.midpoint.amount);
    expect(result.max.amount).toBeGreaterThanOrEqual(result.midpoint.amount);
    expect(result.netEquity.amount).toBe(200_000);
    expect(result.assumptions.length).toBeGreaterThan(0);
  });

  it("retourne une soulte nulle si equity nulle", () => {
    const result = runQuickEstimate({
      status: "concubinage",
      intent: "keep_home",
      propertyValue: 200_000,
      mortgageRemaining: 200_000,
    });

    expect(result.midpoint.amount).toBe(0);
    expect(result.netEquity.amount).toBe(0);
  });

  it("adapte le scénario walk_away (B garde)", () => {
    const keep = runQuickEstimate({
      status: "concubinage",
      intent: "keep_home",
      propertyValue: 300_000,
      mortgageRemaining: 100_000,
    });
    const walk = runQuickEstimate({
      status: "concubinage",
      intent: "walk_away",
      propertyValue: 300_000,
      mortgageRemaining: 100_000,
    });

    expect(keep.soulte?.payer).toBe("A");
    expect(walk.soulte?.payer).toBe("B");
    expect(keep.midpoint.amount).toBe(walk.midpoint.amount);
  });

  it("utilise communauté légale pour mariage", () => {
    const result = runQuickEstimate({
      status: "marriage",
      marriageRegime: "communaute_legale",
      intent: "keep_home",
      propertyValue: 500_000,
      mortgageRemaining: 150_000,
    });

    expect(result.midpoint.amount).toBe(175_000);
    expect(result.assumptions.some((a) => a.code === "REGIME")).toBe(true);
  });
});
