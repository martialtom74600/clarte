/** Prix de vente indicatifs €/m² par département (barème interne 2026 — fallback DVF). */
export const PRICE_PER_SQM_BY_DEPT: Record<string, number> = {
  "75": 10500,
  "92": 6200,
  "93": 4800,
  "94": 5100,
  "69": 4800,
  "13": 3500,
  "33": 4200,
  "06": 5200,
  default: 2800,
};

export function deptFromPostal(postalCode: string): string {
  if (!postalCode || postalCode.length < 2) return "default";
  if (postalCode.startsWith("20")) return "2A";
  return postalCode.slice(0, 2);
}

export function pricePerSqmForDept(dept: string): number {
  return PRICE_PER_SQM_BY_DEPT[dept] ?? PRICE_PER_SQM_BY_DEPT.default;
}

export function pricePerSqmForPostal(postalCode: string): number {
  return pricePerSqmForDept(deptFromPostal(postalCode));
}
