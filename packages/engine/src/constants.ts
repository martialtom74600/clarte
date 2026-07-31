/**
 * Hypothèses financières et réglementaires centralisées.
 * Mettre à jour ce fichier lorsque les barèmes marché ou HCSF évoluent.
 */

/** Plafond légal HCSF — part des revenus consacrée au remboursement (35 %). */
export const HCSF_MAX_EFFORT_RATIO = 0.35;

/** Même plafond, exprimé en pourcentage entier pour l'UI. */
export const HCSF_MAX_EFFORT_PERCENT = 35;

/** Seuils indicatifs verdict endettement (keep) — légèrement gradués autour du plafond HCSF. */
export const DEBT_VERDICT_GREEN_MAX_RATIO = 0.33;
export const DEBT_VERDICT_ORANGE_MAX_RATIO = 0.38;

/** Assurance emprunteur par défaut — taux annuel sur capital initial (0,34 %). */
export const DEFAULT_MORTGAGE_INSURANCE_ANNUAL_RATE = 0.0034;

/** Durée de référence pour le taux marché et le refinancement indicatif. */
export const DEFAULT_MORTGAGE_DURATION_YEARS = 20;

/** Date de validité du barème marché indicatif. */
export const MARKET_MORTGAGE_RATE_AS_OF = "2026-07";

/**
 * Taux marché indicatif sur 20 ans (référence « taux actuels »).
 * Les durées 15 et 25 ans sont dérivées dans MARKET_MORTGAGE_RATES_BY_DURATION.
 */
export const CURRENT_MARKET_MORTGAGE_RATE = 0.0385;

/** Barème indicatif par durée — non contractuel, à actualiser mensuellement. */
export const MARKET_MORTGAGE_RATES_BY_DURATION: Record<
  number,
  { rate: number; asOf: string }
> = {
  15: { rate: 0.0365, asOf: MARKET_MORTGAGE_RATE_AS_OF },
  20: { rate: CURRENT_MARKET_MORTGAGE_RATE, asOf: MARKET_MORTGAGE_RATE_AS_OF },
  25: { rate: 0.041, asOf: MARKET_MORTGAGE_RATE_AS_OF },
};
