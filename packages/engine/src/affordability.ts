import type {
  AffordabilityResult,
  AffordabilityVerdict,
  LifePathDoor,
  Money,
  NewLifeCapInput,
  NewLifeCapResult,
  PersonId,
  ZoneMarketSnapshot,
} from "@separation/schemas";
import { estimateMonthlyPayment, eur, round } from "./utils.js";
import { getMortgageRateSnapshot } from "./mortgage-rates.js";

const DEFAULT_MAX_EFFORT = 0.35;
const CHARGES_ESTIMATE_MONTHLY = 180;

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

export function rentPerSqm(postalCode: string): number {
  const dept = deptFromPostal(postalCode);
  return RENT_PER_SQM_BY_DEPT[dept] ?? RENT_PER_SQM_BY_DEPT.default;
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

function keeperFromIntent(intent: NewLifeCapInput["intent"]): PersonId {
  if (intent === "walk_away") return "B";
  return "A";
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
  const equityNet = eur(Math.max(0, input.propertyValue - input.mortgageRemaining));
  const contributionsTotal = eur(input.contributionA + input.contributionB);
  const netDepartureCapital: Record<PersonId, Money> = {
    A: eur(input.netWorthA),
    B: eur(input.netWorthB),
  };

  const keeper = keeperFromIntent(input.intent);
  const keeperIncome = keeper === "A" ? input.incomeAMonthly : input.incomeBMonthly;
  const keeperCapital = keeper === "A" ? input.netWorthA : input.netWorthB;
  const soulte = input.soulteAmount ?? 0;
  let liquidAfterSoulte = keeperCapital;
  if (soulte > 0 && input.soultePayer) {
    liquidAfterSoulte =
      input.soultePayer === keeper
        ? Math.max(0, keeperCapital - soulte)
        : keeperCapital + soulte;
  }

  const targetBuyPrice = round(zone.medianPricePerSqm.amount * input.propertySurface);
  const buyAffordability = computeAffordability({
    incomeMonthly: keeperIncome,
    liquidCapital: liquidAfterSoulte,
    targetPropertyPrice: targetBuyPrice,
    existingMonthlyCharges: 0,
    durationYears: rateSnapshot.durationYears,
  });

  const grossRent = round(rentPerSqm(input.postalCode) * input.propertySurface);
  const mortgagePay =
    input.monthlyMortgagePayment > 0
      ? input.monthlyMortgagePayment
      : estimateMonthlyPayment(input.mortgageRemaining, rateSnapshot.annualRate, 20).amount;
  const netRentMonthly = grossRent - mortgagePay - CHARGES_ESTIMATE_MONTHLY;
  const rentVerdict: AffordabilityVerdict =
    netRentMonthly >= 200 ? "green" : netRentMonthly >= 0 ? "orange" : "red";

  const sellProceedsEach = round(equityNet.amount / 2);
  const relocateTarget = round(zone.minPricePerSqm.amount * Math.max(45, input.propertySurface - 15));
  const relocateAffordability = computeAffordability({
    incomeMonthly: keeperIncome,
    liquidCapital: netDepartureCapital[keeper].amount,
    targetPropertyPrice: relocateTarget,
    durationYears: rateSnapshot.durationYears,
  });

  const doors: LifePathDoor[] = [
    {
      id: "buy_in_zone",
      label: "Racheter dans la zone",
      description: `${keeper === "A" ? "Vous" : "L'autre partie"} conserve le logement ou en rachète un comparable (~25 km).`,
      verdict: buyAffordability.verdict,
      headline: buyAffordability.label,
      detail: buyAffordability.detail,
      monthlyImpact: buyAffordability.monthlyPayment,
    },
    {
      id: "rent_out",
      label: "Garder et louer",
      description: "Conserver le bien en location — le loyer couvre (ou non) le crédit.",
      verdict: rentVerdict,
      headline:
        rentVerdict === "green"
          ? `Excédent locatif ~${netRentMonthly.toLocaleString("fr-FR")} €/mois`
          : rentVerdict === "orange"
            ? "Équilibre tendu entre loyer et crédit"
            : "Loyer insuffisant vs crédit restant",
      detail: `Loyer estimé ${grossRent.toLocaleString("fr-FR")} € − crédit ${Math.round(mortgagePay).toLocaleString("fr-FR")} € − charges ~${CHARGES_ESTIMATE_MONTHLY} €`,
      monthlyImpact: eur(netRentMonthly),
    },
    {
      id: "sell_relocate",
      label: "Vendre et repartir",
      description: "Libérer l'équity nette et viser un logement plus accessible dans la zone.",
      verdict: relocateAffordability.verdict,
      headline: relocateAffordability.label,
      detail: `Cible relocation ~${relocateTarget.toLocaleString("fr-FR")} € (${Math.max(45, input.propertySurface - 15)} m²) · ${relocateAffordability.detail}`,
      monthlyImpact: relocateAffordability.monthlyPayment,
    },
  ];

  const recommendedDoorId =
    doors.find((d) => d.verdict === "green")?.id ??
    doors.find((d) => d.verdict === "orange")?.id ??
    "sell_relocate";

  return {
    zone,
    mortgageRate: rateSnapshot,
    equityNet,
    contributionsTotal,
    contributionsByPerson: { A: eur(input.contributionA), B: eur(input.contributionB) },
    netDepartureCapital,
    doors,
    recommendedDoorId,
  };
}
