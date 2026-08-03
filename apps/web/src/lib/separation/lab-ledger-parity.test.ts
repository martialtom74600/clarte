import { describe, it, expect } from "vitest";
import type { DoorId } from "@separation/schemas";
import { buildLabLedger } from "@/lib/separation/lab-ledger-model";
import {
  auditLedgerParity,
  LEDGER_HEADLINE_IDS,
  linesForLedgerDetail,
  pickHeadlineLines,
} from "@/lib/separation/lab-ledger-parity";
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

const DOORS: DoorId[] = ["keep_a", "keep_b", "sell", "sell_rent", "rent_out"];

describe("lab-ledger parity", () => {
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

  for (const doorId of DOORS) {
    it(`${doorId} : structure alignée (sections, hints, headlines)`, () => {
      const ledger = buildLabLedger({
        doorId,
        footprint,
        assumptions: defaultAssumptions(),
        lab: { ...defaultLabState(), activeDoor: doorId },
        result: derived.lastResult,
        doorVerdicts: derived.doorVerdicts,
      });
      expect(ledger).not.toBeNull();

      const issues = auditLedgerParity(ledger!);
      expect(issues, issues.join("; ")).toEqual([]);

      const headlines = pickHeadlineLines(ledger!);
      expect(headlines).toHaveLength(LEDGER_HEADLINE_IDS[doorId].length);
      expect(headlines.map((line) => line.id)).toEqual([...LEDGER_HEADLINE_IDS[doorId]]);

      const detailIds = new Set(linesForLedgerDetail(ledger!).map((l) => l.id));
      for (const id of LEDGER_HEADLINE_IDS[doorId]) {
        expect(detailIds.has(id), `${doorId}: ${id} encore dans le détail`).toBe(false);
      }
      // Le détail garde au moins le chemin de calcul (pas un ledger vide).
      expect(linesForLedgerDetail(ledger!).length).toBeGreaterThan(0);
    });
  }

  it("keep_b : n'affiche pas soulte + capital partant identiques dans le détail", () => {
    const ledger = buildLabLedger({
      doorId: "keep_b",
      footprint,
      assumptions: defaultAssumptions(),
      lab: { ...defaultLabState(), activeDoor: "keep_b" },
      result: derived.lastResult,
      doorVerdicts: derived.doorVerdicts,
    });
    expect(ledger).not.toBeNull();
    const soulte = ledger!.lines.find((l) => l.id === "soulte");
    const departure = ledger!.lines.find((l) => l.id === "departure-capital");
    const detailIds = new Set(linesForLedgerDetail(ledger!).map((l) => l.id));
    if (
      soulte &&
      departure &&
      Math.round(soulte.amount) === Math.round(departure.amount)
    ) {
      expect(detailIds.has("soulte")).toBe(false);
      expect(detailIds.has("departure-capital")).toBe(false);
    }
  });

  it("keep_a et keep_b : contextNote pédagogique si verdict vert ou orange", () => {
    for (const doorId of ["keep_a", "keep_b"] as const) {
      const ledger = buildLabLedger({
        doorId,
        footprint,
        assumptions: defaultAssumptions(),
        lab: { ...defaultLabState(), activeDoor: doorId },
        result: derived.lastResult,
        doorVerdicts: derived.doorVerdicts,
      });
      const color = ledger?.verdict?.verdict;
      if (color === "green" || color === "orange") {
        expect(ledger?.contextNote).toMatch(/tenables|serré|juste/i);
      }
    }
  });
});
