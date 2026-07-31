import { describe, expect, it } from "vitest";
import {
  estimateCapitalGains,
  irAllowanceRate,
  psAllowanceRate,
  CAPITAL_GAINS_IR_RATE,
  CAPITAL_GAINS_PS_RATE,
} from "./capital-gains.js";
import { eur } from "./utils.js";

describe("abattements CGI 150 VC", () => {
  it("IR : 0 avant 6 ans, 100 % à 22 ans", () => {
    expect(irAllowanceRate(5)).toBe(0);
    expect(irAllowanceRate(6)).toBeCloseTo(0.06);
    expect(irAllowanceRate(21)).toBeCloseTo(0.96);
    expect(irAllowanceRate(22)).toBe(1);
  });

  it("PS : 100 % à 30 ans", () => {
    expect(psAllowanceRate(5)).toBe(0);
    expect(psAllowanceRate(30)).toBe(1);
  });
});

describe("estimateCapitalGains", () => {
  it("exonère la résidence principale", () => {
    const cg = estimateCapitalGains(
      {
        id: "h",
        type: "real_estate",
        label: "RP",
        grossValue: eur(400000),
        ownership: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
        isPrimaryResidence: true,
        purchasePrice: eur(250000),
        acquisitionDate: "2010-01-01",
      },
      400000
    );
    expect(cg.totalTax.amount).toBe(0);
    expect(cg.note).toMatch(/150 U/);
  });

  it("exige le prix d'acquisition hors RP", () => {
    const cg = estimateCapitalGains(
      {
        id: "h",
        type: "real_estate",
        label: "Secondaire",
        grossValue: eur(400000),
        ownership: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
        isPrimaryResidence: false,
      },
      400000
    );
    expect(cg.totalTax.amount).toBe(0);
    expect(cg.note).toMatch(/prix d'acquisition/i);
  });

  it("chiffre la PV hors RP avec abattements (10 ans)", () => {
    const asOf = new Date("2026-07-31");
    const cg = estimateCapitalGains(
      {
        id: "h",
        type: "real_estate",
        label: "Secondaire",
        grossValue: eur(400000),
        ownership: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
        isPrimaryResidence: false,
        purchasePrice: eur(200000),
        acquisitionDate: "2016-01-01",
        acquisitionFeesRate: 0.075,
        improvementWorks: eur(0),
      },
      400000,
      asOf
    );
    // cost basis = 200k × 1.075 = 215k ; PV = 185k
    expect(cg.grossGain.amount).toBe(185000);
    expect(cg.holdingYears).toBe(10);
    expect(cg.totalTax.amount).toBeGreaterThan(0);
    expect(cg.totalTax.amount).toBeLessThan(
      185000 * (CAPITAL_GAINS_IR_RATE + CAPITAL_GAINS_PS_RATE)
    );
  });
});
