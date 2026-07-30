import type { MortgageRateSnapshot } from "@separation/schemas";

/** Barème indicatif — à mettre à jour mensuellement (non offre bancaire). */
const RATE_TABLE: Record<number, { rate: number; asOf: string }> = {
  15: { rate: 0.0365, asOf: "2026-07" },
  20: { rate: 0.0385, asOf: "2026-07" },
  25: { rate: 0.041, asOf: "2026-07" },
};

export function getMortgageRateSnapshot(durationYears = 20): MortgageRateSnapshot {
  const entry = RATE_TABLE[durationYears] ?? RATE_TABLE[20];
  return {
    annualRate: entry.rate,
    durationYears,
    asOf: entry.asOf,
    source: "Barème indicatif Clarté — simulation non contractuelle",
  };
}
