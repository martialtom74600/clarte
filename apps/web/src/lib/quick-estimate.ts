import type { QuickEstimateInput, QuickEstimateResult } from "@separation/schemas";
import { runQuickEstimate } from "@separation/engine";

export function computeQuickEstimate(input: QuickEstimateInput): QuickEstimateResult {
  return runQuickEstimate(input);
}

export function formatEstimateRange(result: QuickEstimateResult): string {
  const min = result.min.amount;
  const max = result.max.amount;
  if (min === max) {
    return `${min.toLocaleString("fr-FR")} €`;
  }
  return `${min.toLocaleString("fr-FR")} € — ${max.toLocaleString("fr-FR")} €`;
}

export const CONFIDENCE_LABELS: Record<QuickEstimateResult["confidence"], string> = {
  low: "Ordre de grandeur — à affiner",
  medium: "Estimation de marché local",
  high: "Valeur déclarée — soulte indicative",
};
