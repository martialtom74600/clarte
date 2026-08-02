import { describe, it, expect } from "vitest";
import { emptyEmpreinteDraft } from "./empreinte-screens";
import {
  getFinancementEstimateMissingFields,
  normalizeMortgageStartDate,
  parseMortgageStartDate,
  resolveFinancementValues,
} from "./empreinte-amortization";

describe("parseMortgageStartDate", () => {
  it("accepte MM/AAAA et saisie compacte", () => {
    expect(parseMortgageStartDate("01/2021")).toEqual({ month: 1, year: 2021 });
    expect(parseMortgageStartDate("012021")).toEqual({ month: 1, year: 2021 });
  });

  it("accepte séparateurs variés et année sur 2 chiffres", () => {
    expect(parseMortgageStartDate("01-2021")).toEqual({ month: 1, year: 2021 });
    expect(parseMortgageStartDate("01.2021")).toEqual({ month: 1, year: 2021 });
    expect(parseMortgageStartDate("1/21")).toEqual({ month: 1, year: 2021 });
    expect(parseMortgageStartDate("0121")).toEqual({ month: 1, year: 2021 });
    expect(parseMortgageStartDate("2021/01")).toEqual({ month: 1, year: 2021 });
    expect(parseMortgageStartDate("2021-01")).toEqual({ month: 1, year: 2021 });
  });
});

describe("getFinancementEstimateMissingFields", () => {
  it("liste les champs obligatoires manquants", () => {
    expect(getFinancementEstimateMissingFields(emptyEmpreinteDraft())).toEqual([
      "capital emprunté",
      "date de souscription (MM/AAAA, ex. 01/2021)",
      "durée du prêt (1–30 ans)",
      "taux d'intérêt",
    ]);
    expect(
      getFinancementEstimateMissingFields(
        emptyEmpreinteDraft({
          initialMortgagePrincipal: "350000",
          mortgageStartDate: "01/2021",
          initialMortgageDurationYears: "25",
          initialMortgageRate: "1,2",
        })
      )
    ).toEqual([]);
  });
});

describe("resolveFinancementValues", () => {
  it("retourne zéros en mode sans crédit", () => {
    const values = resolveFinancementValues(
      emptyEmpreinteDraft({ financementNoCredit: "1" })
    );
    expect(values.mortgageRemaining).toBe(0);
    expect(values.monthlyMortgagePayment).toBe(0);
    expect(values.mortgageRemainingYears).toBe(0);
  });

  it("ignore un capital d'estimation résiduel en mode sans crédit", () => {
    const values = resolveFinancementValues(
      emptyEmpreinteDraft({
        financementNoCredit: "1",
        initialMortgagePrincipal: "350000",
        mortgageStartDate: "01/2021",
        initialMortgageDurationYears: "25",
        initialMortgageRate: "1,2",
      })
    );
    expect(values.mortgageRemaining).toBe(0);
    expect(values.initialMortgagePrincipal).toBe(0);
    expect(values.initialMortgageRate).toBe(0);
  });

  it("calcule CRD et mensualité en mode estimation", () => {
    const values = resolveFinancementValues(
      emptyEmpreinteDraft({
        initialMortgagePrincipal: "350000",
        mortgageStartDate: "01/2021",
        initialMortgageDurationYears: "25",
        initialMortgageRate: "1,2",
      })
    );
    expect(values.mortgageRemaining).toBeGreaterThan(275_000);
    expect(values.mortgageRemaining).toBeLessThan(285_000);
    expect(values.monthlyMortgagePayment).toBeGreaterThan(1350);
    expect(values.mortgageRemainingYears).toBeGreaterThanOrEqual(1);
    expect(values.initialMortgagePrincipal).toBe(350_000);
    expect(values.initialMortgageRate).toBeCloseTo(0.012);
  });
});
