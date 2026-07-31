import { describe, expect, it } from "vitest";
import {
  computeRentOutCashflow,
  computeRentOutCashflowFromParams,
  DEFAULT_MANAGEMENT_FEE_RATE,
  DEFAULT_PNO_ANNUAL_EUR,
  DEFAULT_PROPERTY_TAX_RATE_ANNUAL,
  DEFAULT_VACANCY_RATE,
  FONCIER_SOCIAL_CONTRIBUTIONS_RATE,
  MICRO_FONCIER_ALLOWANCE_RATE,
} from "./rent-out-cashflow.js";
import { rentPerSqm } from "./market-rents.js";
import { eur, round } from "./utils.js";
import type { SimulationInput } from "@separation/schemas";

describe("computeRentOutCashflowFromParams", () => {
  it("calcule le cashflow net après vacance, TF, PNO, gestion et micro-foncier", () => {
    const postalCode = "75011";
    const surface = 65;
    const propertyValue = 400000;
    const mortgage = 900;
    const result = computeRentOutCashflowFromParams({
      postalCode,
      surfaceSqm: surface,
      propertyValue,
      mortgagePaymentMonthly: mortgage,
      marginalIncomeTaxRate: 0.3,
    });

    const gross = round(rentPerSqm(postalCode) * surface); // 22 × 65 = 1430
    expect(gross).toBe(1430);
    expect(result.breakdown.grossRent.amount).toBe(1430);

    const vacancy = round(gross * DEFAULT_VACANCY_RATE); // 85.8
    expect(result.breakdown.vacancyProvision.amount).toBe(vacancy);
    const effective = round(gross - vacancy);
    expect(result.breakdown.effectiveRent.amount).toBe(effective);

    const tfMonthly = round((propertyValue * DEFAULT_PROPERTY_TAX_RATE_ANNUAL) / 12);
    expect(result.breakdown.propertyTaxMonthly.amount).toBe(tfMonthly);

    const pnoMonthly = round(DEFAULT_PNO_ANNUAL_EUR / 12);
    expect(result.breakdown.pnoMonthly.amount).toBe(pnoMonthly);

    const management = round(effective * DEFAULT_MANAGEMENT_FEE_RATE);
    expect(result.breakdown.managementFees.amount).toBe(management);

    const taxable = round(effective * (1 - MICRO_FONCIER_ALLOWANCE_RATE));
    const tax = round(taxable * (0.3 + FONCIER_SOCIAL_CONTRIBUTIONS_RATE));
    expect(result.breakdown.incomeTaxEstimate.amount).toBe(tax);

    const net = round(effective - mortgage - tfMonthly - pnoMonthly - management - tax);
    expect(result.breakdown.netCashflow.amount).toBe(net);
    expect(result.netCashflowByPerson.A.amount).toBe(round(net * 0.5));
    expect(result.netCashflowByPerson.B.amount).toBe(round(net * 0.5));
    expect(result.formulaDetail).toMatch(/micro-foncier/);
    expect(result.formulaDetail).toMatch(/=/);
  });

  it("permet la gestion directe (sans frais d'agence)", () => {
    const withMgmt = computeRentOutCashflowFromParams({
      postalCode: "75011",
      surfaceSqm: 65,
      propertyValue: 400000,
      mortgagePaymentMonthly: 900,
      managementDelegated: true,
      marginalIncomeTaxRate: 0.3,
    });
    const selfManaged = computeRentOutCashflowFromParams({
      postalCode: "75011",
      surfaceSqm: 65,
      propertyValue: 400000,
      mortgagePaymentMonthly: 900,
      managementDelegated: false,
      marginalIncomeTaxRate: 0.3,
    });
    expect(selfManaged.breakdown.managementFees.amount).toBe(0);
    expect(selfManaged.breakdown.netCashflow.amount).toBeGreaterThan(
      withMgmt.breakdown.netCashflow.amount
    );
  });

  it("respecte un override de loyer brut", () => {
    const result = computeRentOutCashflowFromParams({
      postalCode: "75011",
      surfaceSqm: 65,
      propertyValue: 400000,
      mortgagePaymentMonthly: 900,
      monthlyRentOverride: 2000,
      marginalIncomeTaxRate: 0.3,
    });
    expect(result.breakdown.grossRent.amount).toBe(2000);
  });
});

describe("computeRentOutCashflow — simulation", () => {
  it("produit un net bilatéral 50/50 depuis un input complet", () => {
    const asset = {
      id: "house",
      type: "real_estate" as const,
      label: "Appart",
      grossValue: eur(400000),
      ownership: { kind: "indivision" as const, shares: { A: 0.5, B: 0.5 } },
      isPrimaryResidence: true,
      linkedLiabilityIds: ["mortgage"],
    };
    const input: SimulationInput = {
      status: "concubinage",
      persons: [
        { id: "A", income: eur(5000) },
        { id: "B", income: eur(4000) },
      ],
      assets: [asset],
      liabilities: [
        {
          id: "mortgage",
          type: "mortgage",
          remainingBalance: eur(200000),
          responsibility: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
          linkedAssetId: "house",
        },
      ],
      options: { primaryResidenceId: "house", scenario: "rent_out" },
      postalCode: "75011",
      propertySurface: 65,
      monthlyMortgagePayment: 900,
    };
    const result = computeRentOutCashflow(asset, input.liabilities, input);
    expect(result.breakdown.mortgagePayment.amount).toBe(900);
    expect(result.breakdown.microFoncierAllowanceRate).toBe(0.3);
    expect(result.netCashflowByPerson.A.amount).toBe(result.netCashflowByPerson.B.amount);
  });
});
