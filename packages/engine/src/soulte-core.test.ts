import { describe, it, expect } from "vitest";
import {
  computeSoulteCore,
  resolveEffectiveShares,
  usesRecompenseModel,
  droitDePartageRate,
  DEFAULT_EMOLUMENTS_RATE_ON_NET,
  DROIT_PARTAGE_RATE_CONCUBINAGE,
  DROIT_PARTAGE_RATE_MARRIAGE_PACS,
  eur,
} from "../src/index.js";
import type { SimulationInput } from "@separation/schemas";

const baseAsset = {
  id: "house",
  type: "real_estate" as const,
  label: "Appartement",
  grossValue: eur(400000),
  ownership: { kind: "indivision" as const, shares: { A: 0.5, B: 0.5 } },
  isPrimaryResidence: true,
  linkedLiabilityIds: ["mortgage"],
};

const communityAsset = {
  ...baseAsset,
  ownership: { kind: "community" as const },
};

const baseLiabilities: SimulationInput["liabilities"] = [
  {
    id: "mortgage",
    type: "mortgage",
    remainingBalance: eur(200000),
    responsibility: { kind: "indivision", shares: { A: 0.5, B: 0.5 } },
    linkedAssetId: "house",
  },
];

function baseInput(overrides: Partial<SimulationInput> = {}): SimulationInput {
  return {
    status: "concubinage",
    persons: [{ id: "A" }, { id: "B" }],
    assets: [baseAsset],
    liabilities: baseLiabilities,
    options: { primaryResidenceId: "house", scenario: "keep_a" },
    ...overrides,
  };
}

describe("resolveEffectiveShares", () => {
  it("utilise la quote-part légale sans apports", () => {
    const shares = resolveEffectiveShares(baseAsset, baseInput());
    expect(shares.shareA).toBe(0.5);
    expect(shares.shareB).toBe(0.5);
    expect(shares.contributionAdjusted).toBe(false);
    expect(shares.mode).toBe("none");
  });

  it("en indivision, conserve les parts légales (mode créance 815-13)", () => {
    const shares = resolveEffectiveShares(
      baseAsset,
      baseInput({ contributionA: 20000, contributionB: 30000 })
    );
    expect(shares.shareA).toBe(0.5);
    expect(shares.shareB).toBe(0.5);
    expect(shares.mode).toBe("creance");
  });

  it("legacy share_rewrite reste disponible en opt-in", () => {
    const shares = resolveEffectiveShares(
      baseAsset,
      baseInput({
        contributionA: 20000,
        contributionB: 30000,
        options: { primaryResidenceId: "house", scenario: "keep_a", legacyShareRewrite: true },
      })
    );
    expect(shares.shareA).toBeCloseTo(0.4);
    expect(shares.shareB).toBeCloseTo(0.6);
    expect(shares.mode).toBe("share_rewrite");
  });

  it("en communauté, conserve le 50/50 (récompense, pas rewrite)", () => {
    const shares = resolveEffectiveShares(
      communityAsset,
      baseInput({
        status: "marriage",
        marriageRegime: "communaute_legale",
        contributionA: 20000,
        contributionB: 30000,
        assets: [communityAsset],
      })
    );
    expect(shares.shareA).toBe(0.5);
    expect(shares.shareB).toBe(0.5);
    expect(shares.mode).toBe("recompense");
    expect(usesRecompenseModel(communityAsset, baseInput({
      status: "marriage",
      marriageRegime: "communaute_legale",
      contributionA: 20000,
      contributionB: 30000,
      assets: [communityAsset],
    }))).toBe(true);
  });
});

describe("C1 — droit de partage & émoluments", () => {
  it("applique 2,50 % + 1,5 % sur l'actif net en concubinage (pas 7,5 % de la soulte)", () => {
    const soulte = computeSoulteCore(baseAsset, baseLiabilities, "A", baseInput());
    expect(soulte.amount.amount).toBe(100000);
    expect(droitDePartageRate("concubinage")).toBe(DROIT_PARTAGE_RATE_CONCUBINAGE);
    expect(soulte.droitDePartage?.amount).toBe(200000 * DROIT_PARTAGE_RATE_CONCUBINAGE);
    expect(soulte.emolumentsEstimate?.amount).toBe(200000 * DEFAULT_EMOLUMENTS_RATE_ON_NET);
    expect(soulte.notaryFeesEstimate?.amount).toBe(
      200000 * (DROIT_PARTAGE_RATE_CONCUBINAGE + DEFAULT_EMOLUMENTS_RATE_ON_NET)
    );
    expect(soulte.totalCashNeeded?.amount).toBe(
      100000 + 200000 * (DROIT_PARTAGE_RATE_CONCUBINAGE + DEFAULT_EMOLUMENTS_RATE_ON_NET)
    );
  });

  it("applique 1,10 % en mariage / PACS (CGI 746)", () => {
    const married = computeSoulteCore(
      communityAsset,
      [{ ...baseLiabilities[0], responsibility: { kind: "community" } }],
      "A",
      baseInput({
        status: "marriage",
        marriageRegime: "communaute_legale",
        assets: [communityAsset],
        liabilities: [{ ...baseLiabilities[0], responsibility: { kind: "community" } }],
      })
    );
    expect(droitDePartageRate("marriage")).toBe(DROIT_PARTAGE_RATE_MARRIAGE_PACS);
    expect(droitDePartageRate("pacs")).toBe(DROIT_PARTAGE_RATE_MARRIAGE_PACS);
    expect(married.droitDePartage?.amount).toBe(200000 * DROIT_PARTAGE_RATE_MARRIAGE_PACS);
  });
});

describe("C3 — récompenses en communauté", () => {
  it("impute les apports en récompenses (200k net, 20k/30k → soulte 105k)", () => {
    // masse après récompenses = 150k → moitié 75k + récompense B 30k = 105k
    const soulte = computeSoulteCore(
      communityAsset,
      [{ ...baseLiabilities[0], responsibility: { kind: "community" } }],
      "A",
      baseInput({
        status: "marriage",
        marriageRegime: "communaute_legale",
        contributionA: 20000,
        contributionB: 30000,
        assets: [communityAsset],
        liabilities: [{ ...baseLiabilities[0], responsibility: { kind: "community" } }],
      })
    );
    expect(soulte.amount.amount).toBe(105000);
    expect(soulte.recompenseA?.amount).toBe(20000);
    expect(soulte.recompenseB?.amount).toBe(30000);
  });

  it("en indivision, prélève les créances avant partage (20k/30k → 105k)", () => {
    // masse 200k − 50k créances = 150k → 75k + créance B 30k = 105k
    const soulte = computeSoulteCore(
      baseAsset,
      baseLiabilities,
      "A",
      baseInput({ contributionA: 20000, contributionB: 30000 })
    );
    expect(soulte.amount.amount).toBe(105000);
    expect(soulte.contributionMode).toBe("creance");
    expect(soulte.creanceA?.amount).toBe(20000);
    expect(soulte.creanceB?.amount).toBe(30000);
  });

  it("mariage + acte en indivision 60/40 : créance (pas récompense 50/50)", () => {
    const unequal = {
      ...baseAsset,
      ownership: { kind: "indivision" as const, shares: { A: 0.6, B: 0.4 } },
    };
    const liabilities = [
      {
        ...baseLiabilities[0],
        responsibility: { kind: "indivision" as const, shares: { A: 0.6, B: 0.4 } },
      },
    ];
    const soulte = computeSoulteCore(
      unequal,
      liabilities,
      "A",
      baseInput({
        status: "marriage",
        marriageRegime: "communaute_legale",
        contributionA: 20000,
        contributionB: 30000,
        assets: [unequal],
        liabilities,
      })
    );
    // masse 150k × 40 % + 30k = 90k (et non 106 250 en récompense)
    expect(soulte.contributionMode).toBe("creance");
    expect(soulte.amount.amount).toBe(90000);
    expect(usesRecompenseModel(unequal, baseInput({
      status: "marriage",
      marriageRegime: "communaute_legale",
      contributionA: 20000,
      contributionB: 30000,
      assets: [unequal],
    }))).toBe(false);
  });

  it("récompense 1469 valorise le profit si prix d'acquisition connu", () => {
    const asset = {
      ...communityAsset,
      purchasePrice: eur(300000),
      grossValue: eur(400000),
    };
    const soulte = computeSoulteCore(
      asset,
      [{ ...baseLiabilities[0], responsibility: { kind: "community" } }],
      "A",
      baseInput({
        status: "marriage",
        marriageRegime: "communaute_legale",
        contributionA: 30000,
        contributionB: 0,
        assets: [asset],
        liabilities: [{ ...baseLiabilities[0], responsibility: { kind: "community" } }],
      })
    );
    // récompense A = 30k × (400k/300k) = 40k
    expect(soulte.recompenseA?.amount).toBe(40000);
    expect(soulte.contributionMode).toBe("recompense");
  });
});

describe("C4 — package de refinancement", () => {
  it("refinanceAmount = CRD + soulte + frais", () => {
    const soulte = computeSoulteCore(baseAsset, baseLiabilities, "A", baseInput());
    const fees = soulte.notaryFeesEstimate!.amount;
    expect(soulte.refinanceAmount?.amount).toBe(200000 + 100000 + fees);
  });
});

describe("equity négative", () => {
  it("CRD > valeur : soulte nulle + residualDebt", () => {
    const underwater = {
      ...baseAsset,
      grossValue: eur(200000),
    };
    const liabilities = [
      {
        id: "mortgage",
        type: "mortgage" as const,
        remainingBalance: eur(250000),
        responsibility: { kind: "indivision" as const, shares: { A: 0.5, B: 0.5 } },
        linkedAssetId: "house",
      },
    ];
    const soulte = computeSoulteCore(underwater, liabilities, "A", baseInput({
      assets: [underwater],
      liabilities,
    }));
    expect(soulte.negativeEquity).toBe(true);
    expect(soulte.amount.amount).toBe(0);
    expect(soulte.residualDebt?.amount).toBe(50000);
    expect(soulte.notaryFeesEstimate?.amount).toBe(0);
    expect(soulte.refinanceAmount?.amount).toBe(250000);
  });
});
