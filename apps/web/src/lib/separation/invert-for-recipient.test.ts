import { describe, it, expect } from "vitest";
import {
  buildRecipientFacingPack,
  counterpartDoorTitle,
  swapPersonWords,
} from "./invert-for-recipient";
import { recomputeSeparationDerived } from "./recompute-derived";
import { defaultAssumptions, defaultLabState } from "./compile-simulation-input";
import type { FootprintState } from "./separation-types";

const footprint: FootprintState = {
  postalCode: "74600",
  propertyValue: 400000,
  propertySurface: 102,
  purchasePrice: 380000,
  mortgageRemaining: 248984,
  monthlyMortgagePayment: 1200,
  mortgageRemainingYears: 18,
  initialMortgagePrincipal: 320000,
  initialMortgageDurationYears: 25,
  mortgageStartMonth: 1,
  mortgageStartYear: 2021,
  initialMortgageRate: 0.012,
  mortgageInsuranceRate: 0.0034,
  mortgageInsuranceMonthly: 85,
  incomeA: 4000,
  incomeB: 2500,
  contributionA: 40000,
  contributionB: 10000,
  legalStatus: "concubinage",
  ownershipShareA: 60,
  ownershipShareB: 40,
  cadreJuridiqueDeclared: true,
  apportsDeclared: true,
  financementDeclared: true,
  completedAt: "2026-01-01T00:00:00.000Z",
};

describe("invert-for-recipient (voix destinataire)", () => {
  it("renomme keep_a → « l'autre garde » sans changer de porte", () => {
    expect(counterpartDoorTitle("keep_a", "")).toMatch(/l'autre garde/i);
    expect(counterpartDoorTitle("keep_b", "")).toMatch(/garder le bien/i);
  });

  it("swapPersonWords protège le français (rendez-vous, conjugaisons)", () => {
    expect(swapPersonWords("Vous rachetez la part")).toMatch(/L'autre rachète/);
    expect(swapPersonWords("L'autre garde le bien")).toMatch(/Vous gardez/);
    expect(swapPersonWords("Prenez rendez-vous à la banque")).toMatch(/rendez-vous/);
    expect(swapPersonWords("Prenez rendez-vous à la banque")).not.toMatch(/rendez-l'autre/);
    expect(swapPersonWords("Vous payez à l'autre")).toBe("L'autre vous paie");
    expect(swapPersonWords("Vous n'étiez pas mariés")).toMatch(/Vous n'étiez pas/);
    expect(swapPersonWords("un logement solo dans votre zone")).toMatch(/dans la zone/);
  });

  it("garde keep_a actif : l'expéditeur rachète toujours, le destinataire lit « l'autre »", () => {
    const lab = { ...defaultLabState(), activeDoor: "keep_a" as const };
    const derived = recomputeSeparationDerived({
      stratum: "laboratoire",
      footprint,
      assumptions: defaultAssumptions(),
      lab,
      marketBuy: null,
      marketRent: null,
      derived: { lastInput: null, lastResult: null, doorVerdicts: null, computedAt: null },
      discreteMode: false,
    });
    const pack = buildRecipientFacingPack({
      footprint,
      assumptions: defaultAssumptions(),
      lab,
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    expect(pack).not.toBeNull();
    expect(pack!.activeDoorId).toBe("keep_a");
    const chapter = pack!.chapters.find((c) => c.doorId === "keep_a");
    expect(chapter?.title).toMatch(/l'autre garde/i);
    const enClair = chapter?.howItWorks.find((b) => b.title === "En clair")?.body ?? "";
    expect(enClair).toMatch(/L'autre garde/);
    expect(enClair).toMatch(/votre part/i);
    expect(enClair).not.toMatch(/Vous gardez le logement/);

    const soulte = chapter?.bilan.ledger.lines.find((l) => l.id === "soulte");
    expect(soulte?.label).toMatch(/L'autre vous paie/i);
    expect(soulte?.label).not.toMatch(/payez/);
    expect(soulte?.hint).toMatch(/votre part/i);

    const bankStep = chapter?.nextSteps.find((s) => /banque/i.test(s)) ?? "";
    expect(bankStep).toMatch(/L'autre devra vérifier/);
    expect(bankStep).toMatch(/rendez-vous|lui laisser/);
    expect(bankStep).not.toMatch(/rendez-l'autre/);

    const apports = chapter?.howItWorks.find((b) => /apports/i.test(b.title))?.body ?? "";
    expect(apports).toMatch(/Vous n'étiez pas/);
    expect(apports).not.toMatch(/L'autre n'étiez/);

    expect(chapter?.bilan.ledger.sectionVoiceDoorId).toBe("keep_b");

    const shares = pack!.footprint.find((f) => f.label === "Répartition de la propriété")?.value;
    expect(shares).toMatch(/Vous 40/);
    expect(shares).toMatch(/Autre 60/);
  });
});
