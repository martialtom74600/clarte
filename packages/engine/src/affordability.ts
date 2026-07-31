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
import { estimateMonthlyPayment, eur, round } from "./utils.js";
import { getMortgageRateSnapshot } from "./mortgage-rates.js";
import {
  computeRentOutCashflowFromParams,
  RENT_GREEN_THRESHOLD,
} from "./rent-out-cashflow.js";

export { rentPerSqm } from "./market-rents.js";

const DEFAULT_MAX_EFFORT = 0.35;
/** Aligné sur sale-proceeds (éviter import circulaire). */
const AGENCY_FEES_RATE = 0.05;
const DIAGNOSTICS_FLAT = 1800;

const PRICE_PER_SQM_BY_DEPT: Record<string, number> = {
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

const ZONE_DEPARTMENTS: Record<string, string[]> = {
  "75": ["75", "92", "93", "94"],
  "69": ["69", "01", "38", "42"],
  "13": ["13", "83", "84"],
  "33": ["33", "24", "47"],
  "06": ["06", "83"],
  default: [],
};

function deptFromPostal(postalCode: string): string {
  if (!postalCode || postalCode.length < 2) return "default";
  if (postalCode.startsWith("20")) return "2A";
  return postalCode.slice(0, 2);
}

function pricePerSqm(dept: string): number {
  return PRICE_PER_SQM_BY_DEPT[dept] ?? PRICE_PER_SQM_BY_DEPT.default;
}

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
  const prices = departments.map((d) => pricePerSqm(d)).sort((a, b) => a - b);
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
  const effortRatio =
    params.incomeMonthly > 0 ? monthlyPayment.amount / params.incomeMonthly : 1;
  const verdict = verdictFromGap(gap.amount, effortRatio);
  const capacity = Math.round(availableBudget.amount).toLocaleString("fr-FR");
  const need = Math.round(params.targetPropertyPrice).toLocaleString("fr-FR");
  const effortPct = Math.round(effortRatio * 100);
  const hcsfLine =
    verdict === "green"
      ? "Le projet reste dans les seuils de financement (HCSF 35 %)."
      : verdict === "orange"
        ? "Le projet est serré par rapport aux seuils de financement (HCSF 35 %)."
        : "Le projet dépasse les seuils de financement (HCSF 35 %).";

  return {
    verdict,
    targetPropertyPrice: eur(params.targetPropertyPrice),
    availableBudget,
    maxBorrowing,
    gap,
    monthlyPayment,
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
    round(zone.medianPricePerSqm.amount * input.propertySurface * 0.35)
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
  const relocateTarget = round(
    zone.minPricePerSqm.amount * Math.max(45, input.propertySurface - 15)
  );
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
      label: "Vendre",
      description:
        "Liquider le bien après frais d'agence (~5 %) + diagnostics, puis se reloger dans la zone.",
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
      ? ["keep_a", "sell", "rent_out", "keep_b"]
      : input.intent === "walk_away"
        ? ["keep_b", "sell", "rent_out", "keep_a"]
        : ["sell", "keep_a", "keep_b", "rent_out"];

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
