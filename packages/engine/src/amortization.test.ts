import { describe, it, expect } from "vitest";
import {
  calculateAmortization,
  DEFAULT_MORTGAGE_INSURANCE_ANNUAL_RATE,
  monthlyPaymentFromPrincipal,
  remainingBalanceAfterMonths,
} from "./amortization.js";

describe("monthlyPaymentFromPrincipal", () => {
  it("calcule la mensualité standard à 1,2 % sur 25 ans", () => {
    const m = monthlyPaymentFromPrincipal(350_000, 0.012, 25);
    expect(m).toBeGreaterThan(1300);
    expect(m).toBeLessThan(1400);
    expect(Math.round(m)).toBe(1351);
  });

  it("gère un taux nul (amortissement linéaire)", () => {
    expect(monthlyPaymentFromPrincipal(120_000, 0, 10)).toBe(1000);
  });
});

describe("remainingBalanceAfterMonths", () => {
  it("retourne le capital initial à p = 0", () => {
    expect(remainingBalanceAfterMonths(350_000, 0.012, 25, 0)).toBe(350_000);
  });

  it("retourne 0 une fois le prêt épuisé", () => {
    expect(remainingBalanceAfterMonths(350_000, 0.012, 25, 300)).toBe(0);
    expect(remainingBalanceAfterMonths(350_000, 0.012, 25, 400)).toBe(0);
  });

  it("diminue le CRD mois après mois", () => {
    const crd66 = remainingBalanceAfterMonths(350_000, 0.012, 25, 66);
    const crd60 = remainingBalanceAfterMonths(350_000, 0.012, 25, 60);
    expect(crd66).toBeLessThan(crd60);
    expect(crd66).toBeGreaterThan(275_000);
    expect(crd66).toBeLessThan(285_000);
  });
});

describe("calculateAmortization", () => {
  const base = {
    principal: 350_000,
    annualRate: 0.012,
    durationYears: 25,
    startMonth: 1,
    startYear: 2021,
    asOfDate: new Date(2026, 6, 15), // 15 juillet 2026 → 66 mois écoulés
  };

  it("précise les mois écoulés au mois près", () => {
    const result = calculateAmortization(base);
    expect(result.elapsedMonths).toBe(66);
    expect(result.totalMonths).toBe(300);
    expect(result.remainingMonths).toBe(234);
  });

  it("écarte 10 mois de CRD vs une approximation annuelle", () => {
    const precise = calculateAmortization(base);
    const coarse = calculateAmortization({
      ...base,
      startMonth: 3, // +2 mois → 64 mois écoulés
    });
    expect(Math.abs(precise.remainingBalance - coarse.remainingBalance)).toBeGreaterThan(
      1000
    );
  });

  it("calcule CRD, mensualité PI et durée restante cohérents", () => {
    const result = calculateAmortization(base);
    expect(result.monthlyPaymentPrincipalInterest).toBe(1350.98);
    expect(result.remainingBalance).toBeGreaterThan(275_000);
    expect(result.remainingBalance).toBeLessThan(285_000);
    expect(result.remainingBalance).toBe(281_741.52);
    expect(result.remainingYears).toBe(20);
  });

  it("additionne l'assurance par défaut (0,34 % / an) à la mensualité HCSF", () => {
    const result = calculateAmortization(base);
    const expectedInsurance = round((350_000 * DEFAULT_MORTGAGE_INSURANCE_ANNUAL_RATE) / 12);
    expect(result.monthlyInsurance).toBe(expectedInsurance);
    expect(result.monthlyPaymentTotal).toBe(
      result.monthlyPaymentPrincipalInterest + result.monthlyInsurance
    );
  });

  it("accepte un coût mensuel d'assurance explicite", () => {
    const result = calculateAmortization({
      ...base,
      monthlyInsuranceEuro: 85,
    });
    expect(result.monthlyInsurance).toBe(85);
    expect(result.monthlyPaymentTotal).toBe(result.monthlyPaymentPrincipalInterest + 85);
  });

  it("retourne zéro si le prêt est remboursé", () => {
    const result = calculateAmortization({
      ...base,
      asOfDate: new Date(2046, 0, 1),
    });
    expect(result.remainingBalance).toBe(0);
    expect(result.remainingMonths).toBe(0);
    expect(result.remainingYears).toBe(0);
  });

  it("retourne des zéros pour un capital nul", () => {
    const result = calculateAmortization({ ...base, principal: 0 });
    expect(result.remainingBalance).toBe(0);
    expect(result.monthlyPaymentTotal).toBe(0);
  });
});

function round(n: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
