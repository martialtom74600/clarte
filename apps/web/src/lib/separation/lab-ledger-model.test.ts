import { describe, it, expect } from "vitest";
import { buildLabLedger, formatAffordabilityVerdictLabel } from "@/lib/separation/lab-ledger-model";
import { groupLedgerLines } from "@/lib/separation/lab-ledger-sections";
import { debtThresholdMessage } from "@/lib/separation/lab-ledger-insights";
import { recomputeSeparationDerived } from "@/lib/separation/recompute-derived";
import { defaultAssumptions, defaultLabState } from "@/lib/separation/compile-simulation-input";
import type { FootprintState } from "@/lib/separation/separation-types";

const footprint: FootprintState = {
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
  ownershipShareA: 50,
  ownershipShareB: 50,
  cadreJuridiqueDeclared: true,
  apportsDeclared: true,
  financementDeclared: true,
  completedAt: "2026-01-01T00:00:00.000Z",
};

describe("formatAffordabilityVerdictLabel", () => {
  it("traduit les verdicts sans fuite red/orange/green", () => {
    expect(formatAffordabilityVerdictLabel("red")).toBe("Difficile");
    expect(formatAffordabilityVerdictLabel("orange")).toBe("Serré");
    expect(formatAffordabilityVerdictLabel("green")).toBe("Tenable");
  });
});

describe("buildLabLedger", () => {
  const baseState = {
    stratum: "laboratoire" as const,
    footprint,
    assumptions: defaultAssumptions(),
    lab: { ...defaultLabState(), activeDoor: "keep_a" as const },
    marketBuy: null,
    marketRent: null,
    derived: { lastInput: null, lastResult: null, doorVerdicts: null, computedAt: null },
    discreteMode: false,
  };

  const derived = recomputeSeparationDerived(baseState);

  it("décompose le calcul pour keep_a", () => {
    const ledger = buildLabLedger({
      doorId: "keep_a",
      footprint,
      assumptions: defaultAssumptions(),
      lab: baseState.lab,
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    expect(ledger?.lines.some((l) => l.id === "property")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "soulte")).toBe(true);
    expect(ledger?.verdict?.verdict).toBeDefined();
  });

  it("intègre les apports quand le levier est actif", () => {
    const lab = {
      ...defaultLabState(),
      activeDoor: "keep_a" as const,
      enabledLevers: ["initial_contributions" as const],
      overrides: {
        initial_contributions: { contributionA: 20000, contributionB: 30000 },
      },
    };
    const withApports = recomputeSeparationDerived({ ...baseState, lab });
    const ledger = buildLabLedger({
      doorId: "keep_a",
      footprint,
      assumptions: defaultAssumptions(),
      lab,
      result: withApports.lastResult,
      doorVerdicts: withApports.doorVerdicts,
    });
    expect(ledger?.lines.some((l) => l.id === "contributions")).toBe(true);
    const soulte = withApports.lastResult?.scenarios.find((s) => s.scenario === "keep_a")?.soulte
      ?.amount.amount;
    expect(soulte).toBe(105000);
  });

  it("affiche les apports footprint sans levier, en mode créance", () => {
    const fp = {
      ...footprint,
      contributionA: 20000,
      contributionB: 30000,
      ownershipShareA: 60,
      ownershipShareB: 40,
      legalStatus: "marriage" as const,
    };
    const withApports = recomputeSeparationDerived({
      ...baseState,
      footprint: fp,
      assumptions: {
        ...defaultAssumptions(),
        status: "marriage",
        shareA: 60,
        shareB: 40,
      },
    });
    const ledger = buildLabLedger({
      doorId: "keep_a",
      footprint: fp,
      assumptions: {
        ...defaultAssumptions(),
        status: "marriage",
        marriageRegime: "communaute_legale",
        shareA: 60,
        shareB: 40,
      },
      lab: defaultLabState(),
      result: withApports.lastResult,
      doorVerdicts: withApports.doorVerdicts,
    });
    const contrib = ledger?.lines.find((l) => l.id === "contributions");
    expect(contrib).toBeDefined();
    expect(contrib?.label).toMatch(/créances/i);
    expect(ledger?.lines.find((l) => l.id === "soulte")?.label).toMatch(/40 %/);
  });

  it("avec mensualité empreinte : affiche crédit conservé + nouveau prêt rachat", () => {
    const keep = derived.lastResult?.scenarios.find((s) => s.scenario === "keep_a");
    expect(keep?.keepFinancingMode).toBe("keep_existing_loan");

    const ledger = buildLabLedger({
      doorId: "keep_a",
      footprint,
      assumptions: defaultAssumptions(),
      lab: baseState.lab,
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    expect(ledger?.lines.some((l) => l.id === "kept-mortgage")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "new-loan")).toBe(true);
    expect(ledger?.lines.find((l) => l.id === "kept-mortgage")?.amount).toBe(950);
    expect(ledger?.lines.find((l) => l.id === "notary")?.hint).toBe(
      "Droit de partage (CGI 746) et émoluments sur le patrimoine net"
    );
    expect(ledger?.warningNote).toMatch(/désolidarisation/i);
    expect(ledger?.footer).not.toMatch(/désolidarisation/i);
    expect(ledger?.footer).toMatch(/endettement sera de \d+ %/);
    expect(ledger?.footer).toMatch(/Projet finançable|limite bancaire de 35 %/);
    expect(ledger?.footer).not.toMatch(/capacité max/i);
    expect(ledger?.footer).not.toMatch(/effort de 0/);
    expect(ledger?.footer).not.toMatch(/:\s*red\b/i);
  });

  it("vente : affiche agence, diagnostics et parts bilatérales", () => {
    const ledger = buildLabLedger({
      doorId: "sell",
      footprint,
      assumptions: defaultAssumptions(),
      lab: { ...defaultLabState(), activeDoor: "sell" },
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    expect(ledger?.lines.some((l) => l.id === "agency")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "diagnostics")).toBe(true);
    expect(ledger?.lines.find((l) => l.id === "agency")?.amount).toBe(20000);
    expect(ledger?.lines.find((l) => l.id === "diagnostics")?.amount).toBe(1800);
    expect(ledger?.lines.find((l) => l.id === "net")?.amount).toBe(178200);
    expect(ledger?.lines.find((l) => l.id === "you")?.amount).toBe(89100);
    expect(ledger?.lines.find((l) => l.id === "other")?.amount).toBe(89100);
    expect(ledger?.lines.some((l) => l.id === "relocate-target")).toBe(true);
    expect(ledger?.footer ?? "").not.toMatch(/Cible solo/i);
    expect(ledger?.contextNote).toMatch(/relogement solo|parts nettes/i);
  });

  it("vente : pas de section mensuel dupliquée, footer allégé", () => {
    const ledger = buildLabLedger({
      doorId: "sell",
      footprint,
      assumptions: defaultAssumptions(),
      lab: { ...defaultLabState(), activeDoor: "sell" },
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    const groups = groupLedgerLines(ledger!.lines);
    expect(groups.some((g) => g.sectionId === "mensuel")).toBe(false);
    expect(groups.some((g) => g.sectionId === "relogement")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "monthly-balance")).toBe(false);
    expect(ledger?.footer).not.toMatch(/Produit net partagé|Relogement solo \(rachat\)/);
    expect(ledger?.contextNote).toBeTruthy();
  });

  it("rent_out : pas de solde mensuel dupliqué (déjà dans résultat)", () => {
    const ledger = buildLabLedger({
      doorId: "rent_out",
      footprint,
      assumptions: defaultAssumptions(),
      lab: { ...defaultLabState(), activeDoor: "rent_out" },
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    const groups = groupLedgerLines(ledger!.lines);
    expect(groups.some((g) => g.sectionId === "mensuel")).toBe(false);
    expect(groups.some((g) => g.sectionId === "resultat")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "monthly-balance")).toBe(false);
    expect(ledger?.lines.some((l) => l.id === "net")).toBe(true);
    expect(ledger?.footer).not.toMatch(/Relogement accessible|Difficile|Serré|Tenable/i);
  });

  it("vente : levier relocate_housing recalcule la cible (surface + médian)", () => {
    const lab = {
      ...defaultLabState(),
      activeDoor: "sell" as const,
      enabledLevers: ["relocate_housing" as const],
      overrides: {
        relocate_housing: { surfaceSqm: 70, marketTier: "median" as const },
      },
    };
    const withLever = recomputeSeparationDerived({
      footprint,
      assumptions: defaultAssumptions(),
      lab,
    });
    const ledger = buildLabLedger({
      doorId: "sell",
      footprint,
      assumptions: defaultAssumptions(),
      lab,
      result: withLever.lastResult,
      doorVerdicts: withLever.doorVerdicts,
    });
    const baseTarget = derived.lastResult?.scenarios.find((s) => s.scenario === "sell")
      ?.relocateTarget?.amount;
    const leverTarget = withLever.lastResult?.scenarios.find((s) => s.scenario === "sell")
      ?.relocateTarget?.amount;
    expect(leverTarget).toBeGreaterThan(baseTarget ?? 0);
    expect(ledger?.lines.find((l) => l.id === "relocate-target")?.label).toMatch(/70 m²/);
    expect(ledger?.lines.find((l) => l.id === "relocate-target")?.label).toMatch(
      /médiane de zone/i
    );
  });

  it("sell_rent : levier relocate_housing recalcule le loyer cible", () => {
    const lab = {
      ...defaultLabState(),
      activeDoor: "sell_rent" as const,
      enabledLevers: ["relocate_housing" as const],
      overrides: {
        relocate_housing: { surfaceSqm: 80, marketTier: "high" as const },
      },
    };
    const withLever = recomputeSeparationDerived({
      footprint,
      assumptions: defaultAssumptions(),
      lab,
    });
    const baseRent = derived.lastResult?.scenarios.find((s) => s.scenario === "sell_rent")
      ?.tenantRentMonthly?.amount;
    const leverRent = withLever.lastResult?.scenarios.find((s) => s.scenario === "sell_rent")
      ?.tenantRentMonthly?.amount;
    expect(leverRent).toBeGreaterThan(baseRent ?? 0);
    const ledger = buildLabLedger({
      doorId: "sell_rent",
      footprint,
      assumptions: defaultAssumptions(),
      lab,
      result: withLever.lastResult,
      doorVerdicts: withLever.doorVerdicts,
    });
    expect(ledger?.lines.find((l) => l.id === "tenant-rent")?.label).toMatch(/80 m²/);
    expect(ledger?.lines.find((l) => l.id === "tenant-rent")?.label).toMatch(/haut de zone/i);
  });

  it("keep_a : expose note de relogement solo sur le scénario", () => {
    const keep = derived.lastResult?.scenarios.find((s) => s.scenario === "keep_a");
    expect(keep?.relocateHousingNote).toMatch(/Cible solo ~\d+ m²/);
    expect(keep?.relocateSurfaceSqm).toBe(36); // 65 × 0,55
    expect(keep?.relocateMarketTier).toBe("entry");
  });

  it("keep_b : même structure que keep_a avec perspective inversée", () => {
    const ledger = buildLabLedger({
      doorId: "keep_b",
      footprint,
      assumptions: defaultAssumptions(),
      lab: { ...defaultLabState(), activeDoor: "keep_b" },
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    expect(ledger?.lines.find((l) => l.id === "notary")?.hint).toContain("patrimoine net");
    expect(ledger?.lines.find((l) => l.id === "monthly")?.label).toMatch(/autre/i);
    expect(ledger?.lines.every((l) => l.sectionId)).toBe(true);
  });

  it("contextNote endettement si dépassement 35 %", () => {
    const tightFootprint = { ...footprint, incomeA: 2200 };
    const tightDerived = recomputeSeparationDerived({
      ...baseState,
      footprint: tightFootprint,
    });
    const ledger = buildLabLedger({
      doorId: "keep_a",
      footprint: tightFootprint,
      assumptions: defaultAssumptions(),
      lab: baseState.lab,
      result: tightDerived.lastResult,
      doorVerdicts: tightDerived.doorVerdicts,
    });
    expect(ledger?.footer).toMatch(/dépasse la limite bancaire de 35 %/);
    expect(ledger?.contextNote).toBeUndefined();
    const pct = Number(ledger?.footer?.match(/endettement sera de (\d+) %/)?.[1]);
    expect(debtThresholdMessage(pct, "keep_a")).toMatch(/dépasse le plafond légal de 35 %/);
  });

  it("keep_b : footer endettement du point de vue lecteur", () => {
    const ledger = buildLabLedger({
      doorId: "keep_b",
      footprint,
      assumptions: defaultAssumptions(),
      lab: { ...defaultLabState(), activeDoor: "keep_b" },
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    expect(ledger?.footer).toMatch(/L'endettement de l'autre sera/);
  });

  it("keep_a : cible de relogement ; capital partant seulement s'il diffère de la soulte", () => {
    const ledger = buildLabLedger({
      doorId: "keep_a",
      footprint,
      assumptions: defaultAssumptions(),
      lab: { ...defaultLabState(), activeDoor: "keep_a" },
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    const soulte = ledger?.lines.find((l) => l.id === "soulte")?.amount;
    const departure = ledger?.lines.find((l) => l.id === "departure-capital")?.amount;
    if (soulte != null && departure != null) {
      expect(departure).not.toBe(soulte);
    }
    expect(ledger?.lines.some((l) => l.id === "relocate-target")).toBe(true);
    expect(ledger?.footer).toMatch(/Partant :|relogement solo/i);
    expect(ledger?.footer).not.toMatch(/Relogement du partant :\s*red/i);
  });

  it("keep_a + occupation : impute l'indemnité sur le rachat", () => {
    const lab = {
      ...defaultLabState(),
      activeDoor: "keep_a" as const,
      enabledLevers: ["occupation_indemnity" as const],
      overrides: { occupation_indemnity: { occupationMonths: 8 } },
    };
    const withOcc = recomputeSeparationDerived({ ...baseState, lab });
    const keep = withOcc.lastResult?.scenarios.find((s) => s.scenario === "keep_a");
    expect(keep?.occupationIndemnity?.amount).toBeGreaterThan(0);

    const ledger = buildLabLedger({
      doorId: "keep_a",
      footprint,
      assumptions: defaultAssumptions(),
      lab,
      result: withOcc.lastResult,
      doorVerdicts: withOcc.doorVerdicts,
    });
    expect(ledger?.lines.some((l) => l.id === "occupation-indemnity")).toBe(true);
    expect(ledger?.lines.find((l) => l.id === "occupation-indemnity")?.amount).toBe(
      keep?.occupationIndemnity?.amount
    );
    expect(ledger?.lines.some((l) => l.id === "buyout-transfer")).toBe(true);
  });

  it("rent_out : décompose loyer − crédit − TF/charges − impôts = cashflow net", () => {
    const ledger = buildLabLedger({
      doorId: "rent_out",
      footprint,
      assumptions: defaultAssumptions(),
      lab: { ...defaultLabState(), activeDoor: "rent_out" },
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    expect(ledger?.lines.some((l) => l.id === "rent")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "vacancy")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "property-tax")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "pno")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "management")).toBe(true);
    expect(ledger?.lines.some((l) => l.id === "tax")).toBe(true);
    expect(ledger?.lines.find((l) => l.id === "net")?.label).toMatch(/Argent net/i);
    expect(ledger?.footer).toMatch(/Zone 75011/i);
    expect(ledger?.contextNote).toBeTruthy();
    const rentScenario = derived.lastResult?.scenarios.find((s) => s.scenario === "rent_out");
    expect(ledger?.lines.find((l) => l.id === "net")?.amount).toBe(
      Math.round(rentScenario?.rentOutBreakdown?.netCashflow.amount ?? NaN)
    );
  });

  it("regroupe les lignes par section thématique", () => {
    const ledger = buildLabLedger({
      doorId: "keep_a",
      footprint,
      assumptions: defaultAssumptions(),
      lab: baseState.lab,
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    const groups = groupLedgerLines(ledger!.lines);
    expect(groups.some((g) => g.sectionId === "bien")).toBe(true);
    expect(groups.some((g) => g.sectionId === "echange")).toBe(true);
    expect(groups.some((g) => g.sectionId === "mensuel")).toBe(true);
    expect(ledger?.lines.every((l) => l.sectionId)).toBe(true);
  });
});
