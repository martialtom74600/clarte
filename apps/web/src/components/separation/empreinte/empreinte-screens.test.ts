import { describe, it, expect } from "vitest";
import {
  EMPREINTE_SCREEN_COUNT,
  EMPREINTE_SCREEN_LABELS,
  EMPREINTE_SCREENS,
  emptyEmpreinteDraft,
  footprintToDraft,
  getScreenValidationHint,
  inferEmpreinteScreen,
  hasActiveLoan,
  isApportsCompleteInFootprint,
  isApportsValid,
  isCadreJuridiqueCompleteInFootprint,
  isCadreJuridiqueValid,
  isFinancementCompleteInFootprint,
  isFinancementValid,
  isFinancementValidForMode,
  inferFinancementUiMode,
  isLocationValid,
  isPatrimoineValid,
  isRevenusValid,
  isScreenValid,
  suggestedInitialMortgagePrincipal,
  withSuggestedInitialPrincipal,
} from "./empreinte-screens";
import type { FootprintState } from "@/lib/separation/separation-types";
import { parseCurrency } from "./empreinte-field";

describe("empreinte screens — pagination thématique", () => {
  it("reste à 6 écrans : maison (1–5) puis revenus (6)", () => {
    expect(EMPREINTE_SCREEN_COUNT).toBe(6);
    expect(EMPREINTE_SCREENS).toEqual([
      "location",
      "patrimoine",
      "cadre_juridique",
      "apports",
      "financement",
      "revenus",
    ]);
    expect(EMPREINTE_SCREEN_LABELS).toMatchObject({
      location: "Lieu",
      patrimoine: "Le bien",
      cadre_juridique: "Propriété",
      apports: "L'achat",
      financement: "Le crédit",
      revenus: "Revenus",
    });
  });

  it("valide la localisation (CP à 5 chiffres)", () => {
    expect(isLocationValid(emptyEmpreinteDraft({ postalCode: "75011" }))).toBe(true);
    expect(isLocationValid(emptyEmpreinteDraft({ postalCode: "750" }))).toBe(false);
    expect(isScreenValid("location", emptyEmpreinteDraft({ postalCode: "74000" }))).toBe(true);
  });

  it("exige surface + valeur sur Le patrimoine", () => {
    expect(
      isPatrimoineValid(
        emptyEmpreinteDraft({
          propertySurface: "65",
          propertyValue: "400000",
        })
      )
    ).toBe(true);
    expect(
      isPatrimoineValid(
        emptyEmpreinteDraft({
          propertySurface: "65",
          propertyValue: "",
        })
      )
    ).toBe(false);
  });

  it("exige statut + parts totalisant 100 % sur le cadre juridique", () => {
    expect(
      isCadreJuridiqueValid(
        emptyEmpreinteDraft({
          legalStatus: "concubinage",
          ownershipShareA: "50",
          ownershipShareB: "50",
        })
      )
    ).toBe(true);
    expect(
      isCadreJuridiqueValid(
        emptyEmpreinteDraft({
          legalStatus: "pacs",
          ownershipShareA: "60",
          ownershipShareB: "40",
        })
      )
    ).toBe(true);
    expect(
      isCadreJuridiqueValid(
        emptyEmpreinteDraft({
          legalStatus: "",
          ownershipShareA: "50",
          ownershipShareB: "50",
        })
      )
    ).toBe(false);
    expect(
      isCadreJuridiqueValid(
        emptyEmpreinteDraft({
          legalStatus: "marriage",
          ownershipShareA: "60",
          ownershipShareB: "30",
        })
      )
    ).toBe(false);
  });

  it("exige le prix d'achat ; apports optionnels ≤ prix", () => {
    expect(isApportsValid(emptyEmpreinteDraft())).toBe(false);
    expect(
      isApportsValid(
        emptyEmpreinteDraft({
          purchasePrice: "380 000",
          contributionA: "40 000",
          contributionB: "20 000",
        })
      )
    ).toBe(true);
    expect(
      isApportsValid(emptyEmpreinteDraft({ purchasePrice: "380 000" }))
    ).toBe(true);
    expect(
      isApportsValid(
        emptyEmpreinteDraft({
          purchasePrice: "100 000",
          contributionA: "80 000",
          contributionB: "40 000",
        })
      )
    ).toBe(false);
  });

  it("suggère le capital emprunté = prix d'achat − apports", () => {
    const draft = emptyEmpreinteDraft({
      purchasePrice: "380 000",
      contributionA: "40 000",
      contributionB: "20 000",
    });
    expect(suggestedInitialMortgagePrincipal(draft)).toBe(320_000);
    expect(
      parseCurrency(withSuggestedInitialPrincipal(draft).initialMortgagePrincipal)
    ).toBe(320_000);
    expect(
      withSuggestedInitialPrincipal({
        ...draft,
        initialMortgagePrincipal: "300 000",
      }).initialMortgagePrincipal
    ).toBe("300 000");
    expect(suggestedInitialMortgagePrincipal(emptyEmpreinteDraft())).toBe(0);
  });

  it("exige les deux revenus sur l'écran revenus", () => {
    expect(isRevenusValid(emptyEmpreinteDraft({ incomeA: "3500", incomeB: "2800" }))).toBe(true);
    expect(isRevenusValid(emptyEmpreinteDraft({ incomeA: "3500", incomeB: "" }))).toBe(false);
    expect(isScreenValid("revenus", emptyEmpreinteDraft({ incomeA: "3500", incomeB: "2800" }))).toBe(
      true
    );
  });

  it("sur Le financement : CRD 0 sans crédit", () => {
    expect(isFinancementValid(emptyEmpreinteDraft({ financementNoCredit: "1" }))).toBe(true);
    expect(hasActiveLoan(emptyEmpreinteDraft({ financementNoCredit: "1" }))).toBe(false);
  });

  it("sur Le financement estimation : paramètres d'origine suffisants", () => {
    const draft = emptyEmpreinteDraft({
      initialMortgagePrincipal: "350000",
      mortgageStartDate: "01/2021",
      initialMortgageDurationYears: "25",
      initialMortgageRate: "1,2",
    });
    expect(isFinancementValid(draft)).toBe(true);
    expect(isFinancementValidForMode(draft, "estimate")).toBe(true);
    expect(isFinancementValidForMode(draft, "no_credit")).toBe(true);
    expect(hasActiveLoan(draft)).toBe(true);
  });

  it("valide le mode sans crédit indépendamment des champs estimate", () => {
    expect(isFinancementValidForMode(emptyEmpreinteDraft(), "no_credit")).toBe(true);
  });

  it("présélectionne estimation si prix d'achat connu, sinon sans crédit", () => {
    expect(inferFinancementUiMode(emptyEmpreinteDraft())).toBe("no_credit");
    expect(
      inferFinancementUiMode(
        emptyEmpreinteDraft({
          purchasePrice: "380 000",
          contributionA: "40 000",
          contributionB: "20 000",
        })
      )
    ).toBe("estimate");
    expect(
      inferFinancementUiMode(emptyEmpreinteDraft({ financementNoCredit: "1" }))
    ).toBe("no_credit");
    expect(
      inferFinancementUiMode(
        emptyEmpreinteDraft({
          initialMortgagePrincipal: "350000",
          mortgageStartDate: "01/2021",
          initialMortgageDurationYears: "25",
          initialMortgageRate: "1,2",
        })
      )
    ).toBe("estimate");
  });

  it("rejette une estimation incomplète", () => {
    expect(isFinancementValid(emptyEmpreinteDraft())).toBe(false);
    expect(
      isFinancementValid(
        emptyEmpreinteDraft({
          initialMortgagePrincipal: "350000",
          mortgageStartDate: "",
          initialMortgageDurationYears: "25",
          initialMortgageRate: "1,2",
        })
      )
    ).toBe(false);
  });

  it("détecte cadre juridique, apports et financement via flags déclaratifs", () => {
    const base: FootprintState = {
      postalCode: "75011",
      propertyValue: 400000,
      propertySurface: 65,
      purchasePrice: 0,
      mortgageRemaining: 0,
      monthlyMortgagePayment: 0,
      mortgageRemainingYears: 0,
      initialMortgagePrincipal: 0,
      initialMortgageDurationYears: 0,
      mortgageStartMonth: 0,
      mortgageStartYear: 0,
      initialMortgageRate: 0,
      mortgageInsuranceRate: 0.0034,
      mortgageInsuranceMonthly: 0,
      incomeA: 0,
      incomeB: 0,
      contributionA: 0,
      contributionB: 0,
      legalStatus: "",
      ownershipShareA: 50,
      ownershipShareB: 50,
      cadreJuridiqueDeclared: false,
      apportsDeclared: false,
      financementDeclared: false,
      completedAt: null,
    };
    expect(isCadreJuridiqueCompleteInFootprint(base)).toBe(false);
    expect(isApportsCompleteInFootprint(base)).toBe(false);
    expect(isFinancementCompleteInFootprint(base)).toBe(false);
    expect(
      isCadreJuridiqueCompleteInFootprint({
        ...base,
        cadreJuridiqueDeclared: true,
        legalStatus: "concubinage",
      })
    ).toBe(true);
    expect(isApportsCompleteInFootprint({ ...base, apportsDeclared: true })).toBe(true);
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
      contributionA: 20000,
      contributionB: 30000,
      legalStatus: "concubinage",
      ownershipShareA: 60,
      ownershipShareB: 40,
      cadreJuridiqueDeclared: true,
      apportsDeclared: true,
      financementDeclared: true,
      completedAt: null,
    };
    const draft = footprintToDraft(footprint);
    expect(draft.postalCode).toBe("74000");
    expect(draft.legalStatus).toBe("concubinage");
    expect(draft.ownershipShareA).toBe("60");
    expect(parseCurrency(draft.contributionA)).toBe(20000);
    expect(isScreenValid("cadre_juridique", draft)).toBe(true);
  });

  it("explique ce qui manque sur chaque écran", () => {
    expect(getScreenValidationHint("location", emptyEmpreinteDraft())).toContain("code postal");
    expect(
      getScreenValidationHint(
        "patrimoine",
        emptyEmpreinteDraft({ propertySurface: "65", propertyValue: "" })
      )
    ).toContain("valeur");
    expect(getScreenValidationHint("cadre_juridique", emptyEmpreinteDraft())).toContain("statut");
    expect(
      getScreenValidationHint("revenus", emptyEmpreinteDraft({ incomeA: "3500", incomeB: "" }))
    ).toContain("autre");
    expect(getScreenValidationHint("apports", emptyEmpreinteDraft())).toContain(
      "prix d'achat"
    );
  });

  it("reprend à l'écran revenus si tout est rempli sauf validation finale", () => {
    const footprint: FootprintState = {
      postalCode: "75011",
      propertyValue: 400000,
      propertySurface: 65,
      purchasePrice: 320000,
      mortgageRemaining: 0,
      monthlyMortgagePayment: 0,
      mortgageRemainingYears: 0,
      initialMortgagePrincipal: 0,
      initialMortgageDurationYears: 0,
      mortgageStartMonth: 0,
      mortgageStartYear: 0,
      initialMortgageRate: 0,
      mortgageInsuranceRate: 0.0034,
      mortgageInsuranceMonthly: 0,
      incomeA: 5000,
      incomeB: 4000,
      contributionA: 0,
      contributionB: 0,
      legalStatus: "concubinage",
      ownershipShareA: 50,
      ownershipShareB: 50,
      cadreJuridiqueDeclared: true,
      apportsDeclared: true,
      financementDeclared: true,
      completedAt: null,
    };
    expect(inferEmpreinteScreen(footprint)).toBe(5);
  });
});
