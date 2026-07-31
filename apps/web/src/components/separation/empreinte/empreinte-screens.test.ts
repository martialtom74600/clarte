import { describe, it, expect } from "vitest";
import {
  EMPREINTE_SCREEN_COUNT,
  footprintToDraft,
  hasActiveLoan,
  isFinancementValid,
  isLocationValid,
  isPatrimoineValid,
  isScreenValid,
  type EmpreinteDraft,
} from "./empreinte-screens";
import type { FootprintState } from "@/lib/separation/separation-types";

function emptyDraft(overrides: Partial<EmpreinteDraft> = {}): EmpreinteDraft {
  return {
    postalCode: "",
    propertyValue: "",
    propertySurface: "",
    purchasePrice: "",
    mortgageRemaining: "",
    monthlyMortgagePayment: "",
    mortgageRemainingYears: "",
    incomeA: "",
    incomeB: "",
    ...overrides,
  };
}

describe("empreinte screens — pagination thématique", () => {
  it("reste à 5 écrans maximum", () => {
    expect(EMPREINTE_SCREEN_COUNT).toBe(5);
  });

  it("valide la localisation (CP à 5 chiffres)", () => {
    expect(isLocationValid(emptyDraft({ postalCode: "75011" }))).toBe(true);
    expect(isLocationValid(emptyDraft({ postalCode: "750" }))).toBe(false);
    expect(isScreenValid("location", emptyDraft({ postalCode: "74000" }))).toBe(true);
  });

  it("exige surface + valeur + prix d'achat (0 accepté) sur Le patrimoine", () => {
    expect(
      isPatrimoineValid(
        emptyDraft({
          propertySurface: "65",
          propertyValue: "400000",
          purchasePrice: "320000",
        })
      )
    ).toBe(true);
    expect(
      isPatrimoineValid(
        emptyDraft({
          propertySurface: "65",
          propertyValue: "400000",
          purchasePrice: "0",
        })
      )
    ).toBe(true);
    expect(
      isPatrimoineValid(
        emptyDraft({
          propertySurface: "65",
          propertyValue: "400000",
          purchasePrice: "",
        })
      )
    ).toBe(false);
    expect(
      isPatrimoineValid(
        emptyDraft({
          propertySurface: "",
          propertyValue: "400000",
          purchasePrice: "0",
        })
      )
    ).toBe(false);
  });

  it("sur Le financement : CRD seul si 0, sinon mensualité + durée", () => {
    expect(isFinancementValid(emptyDraft({ mortgageRemaining: "0" }))).toBe(true);
    expect(hasActiveLoan(emptyDraft({ mortgageRemaining: "0" }))).toBe(false);

    expect(
      isFinancementValid(
        emptyDraft({
          mortgageRemaining: "200000",
          monthlyMortgagePayment: "",
          mortgageRemainingYears: "",
        })
      )
    ).toBe(false);

    expect(
      isFinancementValid(
        emptyDraft({
          mortgageRemaining: "200000",
          monthlyMortgagePayment: "1200",
          mortgageRemainingYears: "15",
        })
      )
    ).toBe(true);

    expect(hasActiveLoan(emptyDraft({ mortgageRemaining: "200000" }))).toBe(true);
  });

  it("rejette une durée hors 1–30 ans", () => {
    expect(
      isFinancementValid(
        emptyDraft({
          mortgageRemaining: "100000",
          monthlyMortgagePayment: "800",
          mortgageRemainingYears: "40",
        })
      )
    ).toBe(false);
  });

  it("valide les écrans revenus séparément", () => {
    expect(isScreenValid("income_a", emptyDraft({ incomeA: "3500" }))).toBe(true);
    expect(isScreenValid("income_a", emptyDraft({ incomeA: "" }))).toBe(false);
    expect(isScreenValid("income_b", emptyDraft({ incomeB: "2800" }))).toBe(true);
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
      incomeA: 4200,
      incomeB: 3100,
      completedAt: null,
    };
    const draft = footprintToDraft(footprint);
    expect(draft.postalCode).toBe("74000");
    expect(draft.propertySurface).toBe("72");
    expect(draft.mortgageRemainingYears).toBe("18");
    expect(isScreenValid("patrimoine", draft)).toBe(true);
    expect(isScreenValid("financement", draft)).toBe(true);
  });
});
