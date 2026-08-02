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

const RENT_TIER_COEFF: Record<RelocateMarketTier, number> = {
  entry: 0.9,
  median: 1.0,
  high: 1.15,
};

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
  if (tier === "median") return zone.medianPricePerSqm.amount;
  if (tier === "high") return zone.maxPricePerSqm.amount;
  return zone.minPricePerSqm.amount;
}

/**
 * Cible de relogement solo (achat + loyer) — une seule source de vérité.
 * Levier off : surface ≈ 55 % du bien (+ enfants), gamme entrée de zone.
 */
export function resolveRelocateHousing(input: SimulationInput): RelocateHousingResult {
  const postalCode = input.postalCode ?? "75000";
  const currentSurface = input.propertySurface ?? 65;
  const { surfaceSqm, isDefault } = resolveSurface(input, currentSurface);
  const tier = resolveTier(input);
  const zone = buildZoneMarketSnapshot(postalCode, currentSurface);
  const pricePerSqm = pricePerSqmForTier(zone, tier);
  const targetPrice = eur(round(pricePerSqm * surfaceSqm));
  const rentBase = rentPerSqm(postalCode) * RENT_TIER_COEFF[tier];
  const tenantRentMonthly = eur(round(rentBase * surfaceSqm));
  const note = `Cible solo ~${surfaceSqm} m² · gamme ${TIER_LABELS[tier]}`;

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
