/** Loyers indicatifs €/m²/mois par département (barème interne 2026). */
const RENT_PER_SQM_BY_DEPT: Record<string, number> = {
  "75": 22,
  "92": 18,
  "93": 16,
  "94": 17,
  "69": 14,
  "13": 16,
  "33": 13,
  "06": 18,
  default: 11,
};

function deptFromPostal(postalCode: string): string {
  if (!postalCode || postalCode.length < 2) return "default";
  if (postalCode.startsWith("20")) return "2A";
  return postalCode.slice(0, 2);
}

export function rentPerSqm(postalCode: string): number {
  const dept = deptFromPostal(postalCode);
  return RENT_PER_SQM_BY_DEPT[dept] ?? RENT_PER_SQM_BY_DEPT.default;
}
