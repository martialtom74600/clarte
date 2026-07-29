import type { LeadScore } from "@separation/schemas";

export function getCreditPrice(tier: LeadScore["tier"], hasPhone: boolean): number {
  const base = { cold: 1, warm: 2, hot: 3 }[tier];
  return hasPhone ? base : Math.max(1, base - 1);
}

export function creditsToEuroEstimate(credits: number): number {
  return credits * 86;
}
