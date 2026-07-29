import type { LeadPreview } from "@separation/marketplace";

export function isLeadHot(preview: LeadPreview): boolean {
  const created = new Date(preview.created_at);
  const hoursSince = (Date.now() - created.getTime()) / (1000 * 60 * 60);
  return preview.tier === "hot" && preview.complexity_score > 75 && hoursSince < 2;
}

export function complexityDots(score: number): number {
  return Math.min(5, Math.max(1, Math.ceil(score / 20)));
}
