import { describe, it, expect } from "vitest";
import {
  buildEmpreinteContextLine,
  ownershipCaption,
  resolveOwnershipPercents,
} from "./empreinte-context";
import type { FootprintState } from "./separation-types";

const base: FootprintState = {
  postalCode: "75011",
  propertyValue: 400000,
  propertySurface: 65,
  purchasePrice: 320000,
  mortgageRemaining: 200000,
  monthlyMortgagePayment: 950,
  mortgageRemainingYears: 15,
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
  ownershipShareA: 60,
  ownershipShareB: 40,
  cadreJuridiqueDeclared: true,
  apportsDeclared: true,
  financementDeclared: true,
  completedAt: "2026-01-01T00:00:00.000Z",
};

describe("empreinte-context", () => {
  it("résout les parts déclarées", () => {
    expect(resolveOwnershipPercents(base)).toEqual({ shareA: 60, shareB: 40 });
  });

  it("compose la ligne de contexte Portes / Lab", () => {
    const line = buildEmpreinteContextLine({
      ...base,
      contributionA: 20000,
      contributionB: 10000,
      mortgageRemaining: 0,
    });
    expect(line).toContain("Union libre");
    expect(line).toContain("Vous 60 %");
    expect(line).toContain("Autre 40 %");
    expect(line).toContain("Apports inclus");
    expect(line).toContain("Sans crédit");
  });

  it("libellé de part pour une personne", () => {
    expect(ownershipCaption("A", base)).toBe("part 60 %");
    expect(ownershipCaption("B", base)).toBe("part 40 %");
  });
});
