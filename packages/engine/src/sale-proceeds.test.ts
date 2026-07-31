import { describe, expect, it } from "vitest";
import {
  computeSaleProceeds,
  DEFAULT_AGENCY_FEES_RATE,
  DEFAULT_DIAGNOSTICS_FLAT_EUR,
} from "./sale-proceeds.js";
import { eur } from "./utils.js";
import type { SimulationInput } from "@separation/schemas";

const persons: SimulationInput["persons"] = [
  { id: "A", income: eur(5000) },
  { id: "B", income: eur(4000) },
];

const asset = {
  id: "house",
  type: "real_estate" as const,
  label: "Appartement",
  grossValue: eur(400000),
  ownership: { kind: "indivision" as const, shares: { A: 0.5, B: 0.5 } },
  isPrimaryResidence: true,
  linkedLiabilityIds: ["mortgage"],
};

const liabilities: SimulationInput["liabilities"] = [
  {
    id: "mortgage",
    type: "mortgage",
    remainingBalance: eur(200000),
    responsibility: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
    linkedAssetId: "house",
  },
];

function input(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    status: "concubinage",
    persons,
    assets: [asset],
    liabilities,
    options: { primaryResidenceId: "house", scenario: "sell" },
    postalCode: "75011",
    propertySurface: 65,
    ...overrides,
  };
}

describe("computeSaleProceeds — net vendeur bilatéral", () => {
  it("déduit agence 5 % + diagnostics puis répartit 50/50", () => {
    const sale = computeSaleProceeds(asset, liabilities, input());
    expect(sale.agencyFees.amount).toBe(400000 * DEFAULT_AGENCY_FEES_RATE);
    expect(sale.diagnosticsFees.amount).toBe(DEFAULT_DIAGNOSTICS_FLAT_EUR);
    expect(sale.sellingCosts.amount).toBe(20000 + DEFAULT_DIAGNOSTICS_FLAT_EUR);
    // 400k − 20k − 1,8k − 200k = 178 200
    expect(sale.saleNetProceeds.amount).toBe(178200);
    expect(sale.netProceedsByPerson.A.amount).toBe(89100);
    expect(sale.netProceedsByPerson.B.amount).toBe(89100);
    expect(sale.negativeEquity).toBe(false);
  });

  it("applique l'exonération CGI 150 U pour la résidence principale", () => {
    const sale = computeSaleProceeds(asset, liabilities, input());
    expect(sale.primaryResidenceExempt).toBe(true);
    expect(sale.capitalGainsEstimate.amount).toBe(0);
    expect(sale.capitalGainsNote).toMatch(/150 U/);
    expect(sale.capitalGainsNote).toMatch(/exonération/i);
  });

  it("signale l'absence de chiffrage PV hors résidence principale", () => {
    const secondary = { ...asset, isPrimaryResidence: false };
    const sale = computeSaleProceeds(secondary, liabilities, input({ assets: [secondary] }));
    expect(sale.primaryResidenceExempt).toBe(false);
    expect(sale.capitalGainsEstimate.amount).toBe(0);
    expect(sale.capitalGainsNote).toMatch(/prix d'acquisition/i);
  });

  it("calcule un verdict de relogement zone pour A et B", () => {
    const sale = computeSaleProceeds(asset, liabilities, input());
    expect(sale.relocateTarget.amount).toBeGreaterThan(0);
    expect(sale.relocateByPerson.A.verdict).toMatch(/green|orange|red/);
    expect(sale.relocateByPerson.B.verdict).toMatch(/green|orange|red/);
  });

  it("gère l'equity négative après frais", () => {
    const underwater = { ...asset, grossValue: eur(200000) };
    const heavyDebt: SimulationInput["liabilities"] = [
      {
        id: "mortgage",
        type: "mortgage",
        remainingBalance: eur(250000),
        responsibility: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
        linkedAssetId: "house",
      },
    ];
    const sale = computeSaleProceeds(
      underwater,
      heavyDebt,
      input({ assets: [underwater], liabilities: heavyDebt })
    );
    // 200k − 10k − 1,8k − 250k = −61 800
    expect(sale.saleNetProceeds.amount).toBe(-61800);
    expect(sale.negativeEquity).toBe(true);
    expect(sale.netProceedsByPerson.A.amount).toBe(-30900);
    expect(sale.netProceedsByPerson.B.amount).toBe(-30900);
  });
});
