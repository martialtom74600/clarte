import { describe, it, expect } from "vitest";
import type { DoorId } from "@separation/schemas";
import { buildLabLedger } from "@/lib/separation/lab-ledger-model";
import { auditLedgerParity, LEDGER_HEADLINE_IDS, pickHeadlineLines } from "@/lib/separation/lab-ledger-parity";
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
  incomeA: 5000,
  incomeB: 4000,
  completedAt: "2026-01-01T00:00:00.000Z",
};

const DOORS: DoorId[] = ["keep_a", "keep_b", "sell", "rent_out"];

describe("lab-ledger parity", () => {
  const baseState = {
    stratum: "laboratoire" as const,
    footprint,
    assumptions: defaultAssumptions(),
    lab: { ...defaultLabState(), activeDoor: "keep_a" as const },
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
      expect(headlines).toHaveLength(3);
      expect(headlines.map((line) => line.id)).toEqual([...LEDGER_HEADLINE_IDS[doorId]]);
    });
  }

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
