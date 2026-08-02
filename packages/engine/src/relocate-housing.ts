import type { Money, RelocateMarketTier, SimulationInput } from "@separation/schemas";
import { buildZoneMarketSnapshot } from "./affordability.js";
import { rentPerSqm } from "./market-rents.js";
import { eur, round } from "./utils.js";

const DEFAULT_SURFACE_RATIO = 0.55;
const DEFAULT_FLOOR_SQM = 35;
const DEFAULT_CEILING_SQM = 90;
const CHILDREN_CEILING_SQM = 110;
const SQM_PER_CHILD = 12;
const OVERRIDE_MIN_SQM = 25;
const OVERRIDE_MAX_SQM = 150;

/** Achat : entrée −15 % / haut +25 % autour de la médiane (DVF ou barème). */
export const BUY_TIER_COEFF: Record<RelocateMarketTier, number> = {
  entry: 0.85,
  median: 1.0,
  high: 1.25,
};

/** Location : fourchette un peu plus serrée (Phase 2 open data). */
const RENT_TIER_COEFF: Record<RelocateMarketTier, number> = {
  entry: 0.9,
  median: 1.0,
  high: 1.15,
};

/** Construit min / médiane / max €/m² achat à partir d'une médiane unique. */
export function buyPriceBandFromMedian(median: number): {
  minPricePerSqm: number;
  medianPricePerSqm: number;
  maxPricePerSqm: number;
} {
  const medianPricePerSqm = Math.round(median);
  return {
    minPricePerSqm: Math.round(medianPricePerSqm * BUY_TIER_COEFF.entry),
    medianPricePerSqm,
    maxPricePerSqm: Math.round(medianPricePerSqm * BUY_TIER_COEFF.high),
  };
}

const TIER_LABELS: Record<RelocateMarketTier, string> = {
  entry: "entrée de zone",
  median: "médiane de zone",
  high: "haut de zone",
};

export interface RelocateHousingResult {
  surfaceSqm: number;
  tier: RelocateMarketTier;
  pricePerSqm: number;
  targetPrice: Money;
  tenantRentMonthly: Money;
  isDefault: boolean;
  note: string;
}

/** Surface solo par défaut : ~55 % du bien actuel, +12 m²/enfant si renseigné. */
export function defaultRelocateSurfaceSqm(
  currentSurfaceSqm: number,
  numberOfChildren = 0
): number {
  const base = Math.max(1, currentSurfaceSqm);
  const children = Math.max(0, Math.floor(numberOfChildren));
  const raw = Math.round(base * DEFAULT_SURFACE_RATIO) + children * SQM_PER_CHILD;
  const ceiling = children > 0 ? CHILDREN_CEILING_SQM : DEFAULT_CEILING_SQM;
  return Math.min(ceiling, Math.max(DEFAULT_FLOOR_SQM, raw));
}

export function clampRelocateSurfaceSqm(surfaceSqm: number): number {
  return Math.min(OVERRIDE_MAX_SQM, Math.max(OVERRIDE_MIN_SQM, Math.round(surfaceSqm)));
}

function resolveTier(input: SimulationInput): RelocateMarketTier {
  return input.options.relocateMarketTier ?? "entry";
}

function resolveSurface(input: SimulationInput, currentSurface: number): {
  surfaceSqm: number;
  isDefault: boolean;
} {
  const override = input.options.relocateSurfaceSqm;
  if (override != null && override > 0) {
    return { surfaceSqm: clampRelocateSurfaceSqm(override), isDefault: false };
  }
  const children =
    input.hasMinorChildren && (input.numberOfChildren ?? 0) > 0
      ? (input.numberOfChildren ?? 0)
      : 0;
  return {
    surfaceSqm: defaultRelocateSurfaceSqm(currentSurface, children),
    isDefault: true,
  };
}

function pricePerSqmForTier(
  zone: ReturnType<typeof buildZoneMarketSnapshot>,
  tier: RelocateMarketTier
): number {
  const min = zone.minPricePerSqm.amount;
  const median = zone.medianPricePerSqm.amount;
  const max = zone.maxPricePerSqm.amount;
  // Fourchette réelle (DVF injecté ou zone multi-départements) → min / médiane / max.
  if (max > min * 1.02) {
    if (tier === "median") return median;
    if (tier === "high") return max;
    return min;
  }
  // Un seul barème → coefficients achat (−15 % / +25 %).
  const base = median || min || max;
  return round(base * BUY_TIER_COEFF[tier]);
}

/**
 * Cible de relogement solo (achat + loyer) — une seule source de vérité.
 * Prix achat : overrides zone* (DVF côté web) sinon barème départemental.
 * Levier off : surface ≈ 55 % du bien (+ enfants), gamme entrée de zone.
 */
export function resolveRelocateHousing(input: SimulationInput): RelocateHousingResult {
  const postalCode = input.postalCode ?? "75000";
  const currentSurface = input.propertySurface ?? 65;
  const { surfaceSqm, isDefault } = resolveSurface(input, currentSurface);
  const tier = resolveTier(input);
  const zone = buildZoneMarketSnapshot(postalCode, currentSurface, {
    medianPricePerSqm:
      input.zoneMedianPricePerSqm != null && input.zoneMedianPricePerSqm > 0
        ? eur(input.zoneMedianPricePerSqm)
        : undefined,
    minPricePerSqm:
      input.zoneMinPricePerSqm != null && input.zoneMinPricePerSqm > 0
        ? eur(input.zoneMinPricePerSqm)
        : undefined,
    maxPricePerSqm:
      input.zoneMaxPricePerSqm != null && input.zoneMaxPricePerSqm > 0
        ? eur(input.zoneMaxPricePerSqm)
        : undefined,
  });
  const pricePerSqm = pricePerSqmForTier(zone, tier);
  const targetPrice = eur(round(pricePerSqm * surfaceSqm));

  const rentMedian =
    input.zoneRentMedianPerSqm != null && input.zoneRentMedianPerSqm > 0
      ? input.zoneRentMedianPerSqm
      : rentPerSqm(postalCode);
  const rentMin =
    input.zoneRentMinPerSqm != null && input.zoneRentMinPerSqm > 0
      ? input.zoneRentMinPerSqm
      : rentMedian * RENT_TIER_COEFF.entry;
  const rentMax =
    input.zoneRentMaxPerSqm != null && input.zoneRentMaxPerSqm > 0
      ? input.zoneRentMaxPerSqm
      : rentMedian * RENT_TIER_COEFF.high;
  const rentPerSqmTier =
    tier === "high" ? rentMax : tier === "median" ? rentMedian : rentMin;
  const tenantRentMonthly = eur(round(rentPerSqmTier * surfaceSqm));

  const sourceBits: string[] = [];
  if (input.zonePriceSource === "dvf" || input.zonePriceSource === "dvf_dept") {
    sourceBits.push("DVF");
  }
  if (input.zoneRentSource === "carte_loyers") {
    sourceBits.push("Carte des loyers");
  }
  const sourceHint = sourceBits.length > 0 ? ` · ${sourceBits.join(" · ")}` : "";
  const note = `Cible solo ~${surfaceSqm} m² · gamme ${TIER_LABELS[tier]}${sourceHint}`;

  return {
    surfaceSqm,
    tier,
    pricePerSqm,
    targetPrice,
    tenantRentMonthly,
    isDefault,
    note,
  };
}

export function relocateTierLabel(tier: RelocateMarketTier): string {
  return TIER_LABELS[tier];
}
