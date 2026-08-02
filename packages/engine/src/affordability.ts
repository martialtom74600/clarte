import type {
  AffordabilityResult,
  AffordabilityVerdict,
  DoorId,
  LifePathDoor,
  Money,
  NewLifeCapInput,
  NewLifeCapResult,
  PersonId,
  ZoneMarketSnapshot,
} from "@separation/schemas";
import {
  CURRENT_MARKET_MORTGAGE_RATE,
  DEFAULT_MORTGAGE_DURATION_YEARS,
  DEBT_VERDICT_GREEN_MAX_RATIO,
  DEBT_VERDICT_ORANGE_MAX_RATIO,
  HCSF_MAX_EFFORT_PERCENT,
  HCSF_MAX_EFFORT_RATIO,
} from "./constants.js";
import { estimateMonthlyPayment, eur, round } from "./utils.js";
import { getMortgageRateSnapshot } from "./mortgage-rates.js";
import { deptFromPostal, pricePerSqmForDept } from "./market-prices.js";
import {
  computeRentOutCashflowFromParams,
  RENT_GREEN_THRESHOLD,
} from "./rent-out-cashflow.js";
import { rentPerSqm } from "./market-rents.js";

export { rentPerSqm };

const DEFAULT_MAX_EFFORT = HCSF_MAX_EFFORT_RATIO;
/** Aligné sur sale-proceeds (éviter import circulaire). */
const AGENCY_FEES_RATE = 0.05;
const DIAGNOSTICS_FLAT = 1800;

const ZONE_DEPARTMENTS: Record<string, string[]> = {
  "75": ["75", "92", "93", "94"],
  "69": ["69", "01", "38", "42"],
  "13": ["13", "83", "84"],
  "33": ["33", "24", "47"],
  "06": ["06", "83"],
  default: [],
};

export function resolveZoneDepartments(postalCode: string): string[] {
  const dept = deptFromPostal(postalCode);
  const zone = ZONE_DEPARTMENTS[dept];
  if (zone?.length) return zone;
  return [dept === "default" ? "75" : dept];
}

export function buildZoneMarketSnapshot(
  postalCode: string,
  surfaceSqm: number,
  overrides?: Partial<
    Pick<ZoneMarketSnapshot, "medianPricePerSqm" | "minPricePerSqm" | "maxPricePerSqm" | "departments">
  >
): ZoneMarketSnapshot {
  const departments = overrides?.departments ?? resolveZoneDepartments(postalCode);
  const prices = departments.map((d) => pricePerSqmForDept(d)).sort((a, b) => a - b);
  const median = overrides?.medianPricePerSqm?.amount ?? prices[Math.floor(prices.length / 2)];
  const min = overrides?.minPricePerSqm?.amount ?? prices[0];
  const max = overrides?.maxPricePerSqm?.amount ?? prices[prices.length - 1];

  return {
    postalCode,
    radiusKm: 25,
    departments,
    medianPricePerSqm: eur(median),
    minPricePerSqm: eur(min),
    maxPricePerSqm: eur(max),
    surfaceSqm,
    source: "Médianes DVF / barème départemental — zone élargie ~25 km",
    disclaimer:
      "Ordre de grandeur du marché local élargi, pas une estimation de votre bien ni une offre de crédit.",
  };
}

export function computeMaxBorrowing(
  incomeMonthly: number,
  annualRate: number,
  durationYears: number,
  existingMonthlyCharges = 0,
  maxEffortRatio = DEFAULT_MAX_EFFORT
): Money {
  const maxPayment = Math.max(0, incomeMonthly * maxEffortRatio - existingMonthlyCharges);
  if (maxPayment <= 0) return eur(0);

  const monthlyRate = annualRate / 12;
  const months = durationYears * 12;
  if (monthlyRate === 0) return eur(maxPayment * months);

  const principal =
    (maxPayment * (Math.pow(1 + monthlyRate, months) - 1)) /
    (monthlyRate * Math.pow(1 + monthlyRate, months));
  return eur(principal);
}

function verdictFromGap(gap: number, effortRatio: number): AffordabilityVerdict {
  if (gap >= 0 && effortRatio <= 0.33) return "green";
  if (gap >= -50000 && effortRatio <= 0.38) return "orange";
  return "red";
}

export function computeAffordability(params: {
  incomeMonthly: number;
  liquidCapital: number;
  targetPropertyPrice: number;
  existingMonthlyCharges?: number;
  durationYears?: number;
  maxEffortRatio?: number;
}): AffordabilityResult {
  const rateSnapshot = getMortgageRateSnapshot(params.durationYears ?? 20);
  const maxBorrowing = computeMaxBorrowing(
    params.incomeMonthly,
    rateSnapshot.annualRate,
    rateSnapshot.durationYears,
    params.existingMonthlyCharges ?? 0,
    params.maxEffortRatio ?? DEFAULT_MAX_EFFORT
  );
  const availableBudget = eur(params.liquidCapital + maxBorrowing.amount);
  const gap = eur(availableBudget.amount - params.targetPropertyPrice);
  const loanNeeded = Math.max(0, params.targetPropertyPrice - params.liquidCapital);
  const monthlyPayment = estimateMonthlyPayment(
    loanNeeded,
    rateSnapshot.annualRate,
    rateSnapshot.durationYears
  );
  const existingCharges = Math.max(0, params.existingMonthlyCharges ?? 0);
  // Effort global = (nouveau prêt + charges déjà présentes) / revenus — jamais 0 si mensualité > 0.
  const totalMonthlyDebt = monthlyPayment.amount + existingCharges;
  const effortRatio =
    params.incomeMonthly > 0 ? totalMonthlyDebt / params.incomeMonthly : 1;
  const verdict = verdictFromGap(gap.amount, effortRatio);
  const capacity = Math.round(availableBudget.amount).toLocaleString("fr-FR");
  const need = Math.round(params.targetPropertyPrice).toLocaleString("fr-FR");
  const effortPct = Math.round(effortRatio * 100);
  const hcsfLine =
    verdict === "green"
      ? `Le projet reste dans les seuils de financement (HCSF ${HCSF_MAX_EFFORT_PERCENT} %).`
      : verdict === "orange"
        ? `Le projet est serré par rapport aux seuils de financement (HCSF ${HCSF_MAX_EFFORT_PERCENT} %).`
        : `Le projet dépasse les seuils de financement (HCSF ${HCSF_MAX_EFFORT_PERCENT} %).`;

  return {
    verdict,
    targetPropertyPrice: eur(params.targetPropertyPrice),
    availableBudget,
    maxBorrowing,
    gap,
    monthlyPayment: eur(totalMonthlyDebt),
    effortRatio: round(effortRatio, 3),
    maxEffortRatio: params.maxEffortRatio ?? DEFAULT_MAX_EFFORT,
    label:
      verdict === "green"
        ? "Projet tenable dans la zone"
        : verdict === "orange"
          ? "Projet serré — marge limitée"
          : "Projet difficile dans la zone",
    detail: `Votre capacité max : ${capacity} € (effort de ${effortPct} %) · Besoin total du projet : ${need} €.\n${hcsfLine}`,
  };
}

function worstVerdict(a: AffordabilityVerdict, b: AffordabilityVerdict): AffordabilityVerdict {
  const rank: Record<AffordabilityVerdict, number> = { red: 0, orange: 1, green: 2 };
  return rank[a] <= rank[b] ? a : b;
}

/**
 * Capacité locative après vente — effort loyer / revenus + coussin capital.
 * Seuils alignés sur les verdicts d'endettement keep (≈ HCSF).
 */
export function computeTenantRentAffordability(params: {
  incomeMonthly: number;
  rentMonthly: number;
  liquidCapital?: number;
  existingMonthlyCharges?: number;
}): {
  verdict: AffordabilityVerdict;
  effortRatio: number | null;
  monthsBuffer: number;
  detail: string;
} {
  const rent = Math.max(0, params.rentMonthly);
  const charges = Math.max(0, params.existingMonthlyCharges ?? 0);
  const totalHousing = rent + charges;
  const income = params.incomeMonthly;
  const monthsBuffer = rent > 0 ? Math.max(0, params.liquidCapital ?? 0) / rent : 99;

  if (income <= 0) {
    return {
      verdict: "orange",
      effortRatio: null,
      monthsBuffer: round(monthsBuffer, 1),
      detail: "Revenus manquants pour évaluer le loyer.",
    };
  }

  const effortRatio = totalHousing / income;
  const effortPct = Math.round(effortRatio * 100);
  let verdict: AffordabilityVerdict =
    effortRatio <= DEBT_VERDICT_GREEN_MAX_RATIO
      ? "green"
      : effortRatio <= DEBT_VERDICT_ORANGE_MAX_RATIO
        ? "orange"
        : "red";

  // Coussin de vente : 6 mois de loyer peuvent adoucir un orange.
  if (verdict === "orange" && monthsBuffer >= 6) {
    verdict = "green";
  }

  return {
    verdict,
    effortRatio: round(effortRatio, 3),
    monthsBuffer: round(monthsBuffer, 1),
    detail: `Effort locatif ~${effortPct} % (${Math.round(totalHousing).toLocaleString("fr-FR")} € / ${Math.round(income).toLocaleString("fr-FR")} €) · coussin ~${Math.round(monthsBuffer)} mois.`,
  };
}

export function computeNewLifeCap(input: NewLifeCapInput): NewLifeCapResult {
  const zone = buildZoneMarketSnapshot(input.postalCode, input.propertySurface, {
    medianPricePerSqm: input.zoneMedianPricePerSqm
      ? eur(input.zoneMedianPricePerSqm)
      : undefined,
    minPricePerSqm: input.zoneMinPricePerSqm ? eur(input.zoneMinPricePerSqm) : undefined,
    maxPricePerSqm: input.zoneMaxPricePerSqm ? eur(input.zoneMaxPricePerSqm) : undefined,
    departments: input.zoneDepartments,
  });

  const rateSnapshot = getMortgageRateSnapshot(20);
  const equityGross = input.propertyValue - input.mortgageRemaining;
  const sellingCosts = input.propertyValue * AGENCY_FEES_RATE + DIAGNOSTICS_FLAT;
  const equityAfterSaleCosts = equityGross - sellingCosts;
  const equityNet = eur(equityAfterSaleCosts);
  const contributionsTotal = eur(input.contributionA + input.contributionB);

  const soulte = input.soulteAmount ?? 0;
  const liquidAfterSoulte = (person: PersonId, capital: number) => {
    if (soulte <= 0 || !input.soultePayer) return capital;
    return input.soultePayer === person
      ? Math.max(0, capital - soulte)
      : capital + soulte;
  };

  const keepTarget = Math.max(
    soulte,
    round(zone.medianPricePerSqm.amount * input.propertySurface * HCSF_MAX_EFFORT_RATIO)
  );
  const keepAAff = computeAffordability({
    incomeMonthly: input.incomeAMonthly,
    liquidCapital: liquidAfterSoulte("A", input.netWorthA),
    targetPropertyPrice: input.soultePayer === "A" ? Math.max(soulte, keepTarget) : keepTarget,
    durationYears: rateSnapshot.durationYears,
  });
  const keepBAff = computeAffordability({
    incomeMonthly: input.incomeBMonthly,
    liquidCapital: liquidAfterSoulte("B", input.netWorthB),
    targetPropertyPrice: input.soultePayer === "B" ? Math.max(soulte, keepTarget) : keepTarget,
    durationYears: rateSnapshot.durationYears,
  });

  const mortgagePay =
    input.monthlyMortgagePayment > 0
      ? input.monthlyMortgagePayment
      : estimateMonthlyPayment(input.mortgageRemaining, rateSnapshot.annualRate, 20).amount;
  const rentCf = computeRentOutCashflowFromParams({
    postalCode: input.postalCode,
    surfaceSqm: input.propertySurface,
    propertyValue: input.propertyValue,
    mortgagePaymentMonthly: mortgagePay,
    marginalIncomeTaxRate:
      Math.max(input.incomeAMonthly, input.incomeBMonthly) * 12 > 86_547
        ? 0.41
        : 0.3,
  });
  const netRentMonthly = rentCf.breakdown.netCashflow.amount;
  const rentVerdict: AffordabilityVerdict =
    netRentMonthly >= RENT_GREEN_THRESHOLD
      ? "green"
      : netRentMonthly >= 0
        ? "orange"
        : "red";

  const sellProceedsEach = round(Math.max(0, equityAfterSaleCosts) / 2);
  // Aligné sur relocate-housing (évite import circulaire affordability ↔ relocate-housing).
  const relocateSurface = Math.min(
    90,
    Math.max(35, Math.round(input.propertySurface * 0.55))
  );
  const relocateTarget = round(zone.minPricePerSqm.amount * relocateSurface);
  const relocateA = computeAffordability({
    incomeMonthly: input.incomeAMonthly,
    liquidCapital: sellProceedsEach,
    targetPropertyPrice: relocateTarget,
    durationYears: rateSnapshot.durationYears,
  });
  const relocateB = computeAffordability({
    incomeMonthly: input.incomeBMonthly,
    liquidCapital: sellProceedsEach,
    targetPropertyPrice: relocateTarget,
    durationYears: rateSnapshot.durationYears,
  });
  const sellVerdict = worstVerdict(relocateA.verdict, relocateB.verdict);

  const tenantRentMonthly = round(rentPerSqm(input.postalCode) * 0.9 * relocateSurface);
  const tenantA = computeTenantRentAffordability({
    incomeMonthly: input.incomeAMonthly,
    rentMonthly: tenantRentMonthly,
    liquidCapital: sellProceedsEach,
  });
  const tenantB = computeTenantRentAffordability({
    incomeMonthly: input.incomeBMonthly,
    rentMonthly: tenantRentMonthly,
    liquidCapital: sellProceedsEach,
  });
  const sellRentVerdict = worstVerdict(tenantA.verdict, tenantB.verdict);

  const doors: LifePathDoor[] = [
    {
      id: "keep_a",
      label: "Vous rachetez",
      description: "Vous conservez le logement et financez le rachat de la part de l'autre.",
      verdict: keepAAff.verdict,
      headline: keepAAff.label,
      detail: keepAAff.detail,
      monthlyImpact: keepAAff.monthlyPayment,
    },
    {
      id: "keep_b",
      label: "L'autre rachète",
      description: "L'autre partie conserve le logement et finance votre rachat de part.",
      verdict: keepBAff.verdict,
      headline: keepBAff.label,
      detail: keepBAff.detail,
      monthlyImpact: keepBAff.monthlyPayment,
    },
    {
      id: "sell",
      label: "Vendre pour se reloger",
      description:
        "Liquider le bien après frais d'agence (~5 %) + diagnostics, puis racheter dans la zone.",
      verdict: sellVerdict,
      headline:
        sellVerdict === "green"
          ? "Relogement accessible pour les deux"
          : sellVerdict === "orange"
            ? "Relogement serré pour au moins une partie"
            : "Relogement difficile dans la zone",
      detail: `Net vendeur indicatif ~${Math.round(equityAfterSaleCosts).toLocaleString("fr-FR")} € (après ~5 % + diagnostics) · cible relocation ~${relocateTarget.toLocaleString("fr-FR")} € · Vous ${relocateA.verdict} · Autre ${relocateB.verdict}`,
      monthlyImpact: relocateA.monthlyPayment,
    },
    {
      id: "sell_rent",
      label: "Vendre puis louer",
      description:
        "Liquider le bien, récupérer le capital, puis se loger en location dans la zone.",
      verdict: sellRentVerdict,
      headline:
        sellRentVerdict === "green"
          ? "Location accessible pour les deux"
          : sellRentVerdict === "orange"
            ? "Location serrée pour au moins une partie"
            : "Location difficile dans la zone",
      detail: `Net vendeur indicatif ~${Math.round(equityAfterSaleCosts).toLocaleString("fr-FR")} € · loyer zone ~${tenantRentMonthly.toLocaleString("fr-FR")} €/mois · Vous ${tenantA.verdict} · Autre ${tenantB.verdict}`,
      monthlyImpact: eur(tenantRentMonthly),
    },
    {
      id: "rent_out",
      label: "Garder et louer",
      description:
        "Conserver le bien en location — cashflow après crédit, TF, vacance, PNO, gestion et micro-foncier.",
      verdict: rentVerdict,
      headline:
        rentVerdict === "green"
          ? `Cashflow net ~${Math.round(netRentMonthly).toLocaleString("fr-FR")} €/mois`
          : rentVerdict === "orange"
            ? "Équilibre tendu après charges et impôts"
            : "Cashflow locatif insuffisant",
      detail: rentCf.formulaDetail,
      monthlyImpact: eur(netRentMonthly),
    },
  ];

  const preferredOrder: DoorId[] =
    input.intent === "keep_home"
      ? ["keep_a", "sell", "sell_rent", "rent_out", "keep_b"]
      : input.intent === "walk_away"
        ? ["keep_b", "sell", "sell_rent", "rent_out", "keep_a"]
        : ["sell", "sell_rent", "keep_a", "keep_b", "rent_out"];

  const recommendedDoorId =
    preferredOrder.find((id) => doors.find((d) => d.id === id)?.verdict === "green") ??
    preferredOrder.find((id) => doors.find((d) => d.id === id)?.verdict === "orange") ??
    "sell";

  return {
    zone,
    mortgageRate: rateSnapshot,
    equityNet,
    contributionsTotal,
    contributionsByPerson: { A: eur(input.contributionA), B: eur(input.contributionB) },
    netDepartureCapital: {
      A: eur(input.netWorthA),
      B: eur(input.netWorthB),
    },
    doors,
    recommendedDoorId,
  };
}
