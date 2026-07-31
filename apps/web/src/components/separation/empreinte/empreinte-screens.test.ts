import { describe, it, expect } from "vitest";
import {
  EMPREINTE_SCREEN_COUNT,
  EMPREINTE_SCREEN_LABELS,
  EMPREINTE_SCREENS,
  emptyEmpreinteDraft,
  footprintToDraft,
  hasActiveLoan,
  isFinancementValid,
  isLocationValid,
  isPatrimoineValid,
  isScreenValid,
} from "./empreinte-screens";
import type { FootprintState } from "@/lib/separation/separation-types";

describe("empreinte screens — pagination thématique", () => {
  it("reste à 5 écrans maximum avec libellés de progression", () => {
    expect(EMPREINTE_SCREEN_COUNT).toBe(5);
    expect(EMPREINTE_SCREENS).toHaveLength(5);
    expect(EMPREINTE_SCREEN_LABELS.location).toBe("Localisation");
    expect(EMPREINTE_SCREEN_LABELS.financement).toBe("Financement");
    expect(EMPREINTE_SCREEN_LABELS.income_b).toBe("Ses revenus");
  });

  it("valide la localisation (CP à 5 chiffres)", () => {
    expect(isLocationValid(emptyEmpreinteDraft({ postalCode: "75011" }))).toBe(true);
    expect(isLocationValid(emptyEmpreinteDraft({ postalCode: "750" }))).toBe(false);
    expect(isScreenValid("location", emptyEmpreinteDraft({ postalCode: "74000" }))).toBe(true);
  });

  it("exige surface + valeur + prix d'achat (0 accepté) sur Le patrimoine", () => {
    expect(
      isPatrimoineValid(
        emptyEmpreinteDraft({
          propertySurface: "65",
          propertyValue: "400000",
          purchasePrice: "320000",
        })
      )
    ).toBe(true);
    expect(
      isPatrimoineValid(
        emptyEmpreinteDraft({
          propertySurface: "65",
          propertyValue: "400000",
          purchasePrice: "0",
        })
      )
    ).toBe(true);
    expect(
      isPatrimoineValid(
        emptyEmpreinteDraft({
          propertySurface: "65",
          propertyValue: "400000",
          purchasePrice: "",
        })
      )
    ).toBe(false);
  });

  it("sur Le financement : CRD 0 sans crédit", () => {
    expect(isFinancementValid(emptyEmpreinteDraft({ mortgageRemaining: "0" }))).toBe(true);
    expect(hasActiveLoan(emptyEmpreinteDraft({ mortgageRemaining: "0" }))).toBe(false);
  });

  it("sur Le financement manuel : CRD > 0 exige mensualité + durée", () => {
    expect(
      isFinancementValid(
        emptyEmpreinteDraft({
          financementManual: "1",
          mortgageRemaining: "200000",
          monthlyMortgagePayment: "",
          mortgageRemainingYears: "",
        })
      )
    ).toBe(false);

    expect(
      isFinancementValid(
        emptyEmpreinteDraft({
          financementManual: "1",
          mortgageRemaining: "200000",
          monthlyMortgagePayment: "1200",
          mortgageRemainingYears: "15",
        })
      )
    ).toBe(true);
  });

  it("sur Le financement intelligent : paramètres d'origine suffisants", () => {
    expect(
      isFinancementValid(
        emptyEmpreinteDraft({
          initialMortgagePrincipal: "350000",
          mortgageStartDate: "01/2021",
          initialMortgageDurationYears: "25",
          initialMortgageRate: "1,2",
        })
      )
    ).toBe(true);
    expect(
      hasActiveLoan(
        emptyEmpreinteDraft({
          initialMortgagePrincipal: "350000",
          mortgageStartDate: "01/2021",
          initialMortgageDurationYears: "25",
          initialMortgageRate: "1,2",
        })
      )
    ).toBe(true);
  });

  it("rejette une durée hors 1–30 ans en mode manuel", () => {
    expect(
      isFinancementValid(
        emptyEmpreinteDraft({
          financementManual: "1",
          mortgageRemaining: "100000",
          monthlyMortgagePayment: "800",
          mortgageRemainingYears: "40",
        })
      )
    ).toBe(false);
  });

  it("valide les écrans revenus séparément", () => {
    expect(isScreenValid("income_a", emptyEmpreinteDraft({ incomeA: "3500" }))).toBe(true);
    expect(isScreenValid("income_a", emptyEmpreinteDraft({ incomeA: "" }))).toBe(false);
    expect(isScreenValid("income_b", emptyEmpreinteDraft({ incomeB: "2800" }))).toBe(true);
  });

  it("sérialise un footprint vers le draft multi-champs", () => {
    const footprint: FootprintState = {
      postalCode: "74000",
      propertyValue: 450000,
      propertySurface: 72,
      purchasePrice: 380000,
      mortgageRemaining: 210000,
      monthlyMortgagePayment: 1100,
      mortgageRemainingYears: 18,
      initialMortgagePrincipal: 320000,
      initialMortgageDurationYears: 25,
      mortgageStartMonth: 3,
      mortgageStartYear: 2019,
      initialMortgageRate: 0.012,
      mortgageInsuranceRate: 0.0034,
      mortgageInsuranceMonthly: 0,
      incomeA: 4200,
      incomeB: 3100,
      completedAt: null,
    };
    const draft = footprintToDraft(footprint);
    expect(draft.postalCode).toBe("74000");
    expect(draft.propertySurface).toBe("72");
    expect(draft.mortgageStartDate).toBe("03/2019");
    expect(isScreenValid("patrimoine", draft)).toBe(true);
    expect(isScreenValid("financement", draft)).toBe(true);
  });
});
