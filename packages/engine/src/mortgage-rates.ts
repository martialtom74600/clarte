import type { MortgageRateSnapshot } from "@separation/schemas";
import {
  CURRENT_MARKET_MORTGAGE_RATE,
  DEFAULT_MORTGAGE_DURATION_YEARS,
  MARKET_MORTGAGE_RATES_BY_DURATION,
} from "./constants.js";

export function getMortgageRateSnapshot(
  durationYears = DEFAULT_MORTGAGE_DURATION_YEARS
): MortgageRateSnapshot {
  const entry =
    MARKET_MORTGAGE_RATES_BY_DURATION[durationYears] ??
    MARKET_MORTGAGE_RATES_BY_DURATION[DEFAULT_MORTGAGE_DURATION_YEARS];
  return {
    annualRate: entry?.rate ?? CURRENT_MARKET_MORTGAGE_RATE,
    durationYears,
    asOf: entry?.asOf ?? "2026-07",
    source: "Barème indicatif Clarté — simulation non contractuelle",
  };
}
