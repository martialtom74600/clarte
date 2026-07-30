import type {
  AffordabilityVerdict,
  DoorId,
  DoorVerdict,
  DoorVerdictMap,
  PersonId,
  SimulationInput,
  SimulationResult,
} from "@separation/schemas";
import {
  buildZoneMarketSnapshot,
  computeAffordability,
  rentPerSqm,
} from "./affordability.js";
import { getMortgageRateSnapshot } from "./mortgage-rates.js";
import { estimateChildSupport } from "./support.js";
import { eur, estimateMonthlyPayment, round } from "./utils.js";

const CHARGES_ESTIMATE_MONTHLY = 180;
const RENT_GREEN_THRESHOLD = 200;

const DOOR_LABELS: Record<DoorId, string> = {
  keep_a: "Vous rachetez",
  keep_b: "L'autre rachète",
  sell: "Vendre",
  rent_out: "Garder et louer",
};

function worstVerdict(a: AffordabilityVerdict, b: AffordabilityVerdict): AffordabilityVerdict {
  const rank: Record<AffordabilityVerdict, number> = { red: 0, orange: 1, green: 2 };
  return rank[a] <= rank[b] ? a : b;
}

function incomeFor(input: SimulationInput, person: PersonId): number {
  return input.persons.find((p) => p.id === person)?.income?.amount ?? 0;
}

/** Charge mensuelle CEEE si le keeper est le débiteur. */
function childSupportChargeFor(input: SimulationInput, person: PersonId): number {
  if (!input.hasMinorChildren || !input.numberOfChildren || input.numberOfChildren <= 0) {
    return 0;
  }
  const support = estimateChildSupport({
    payerIncomeMonthly: incomeFor(input, "A"),
    recipientIncomeMonthly: incomeFor(input, "B"),
    numberOfChildren: input.numberOfChildren,
    custodyType: input.custodyType === "reduced" ? "reduced" : input.custodyType ?? "classic",
  });
  if (!support || support.payerId !== person) return 0;
  return support.monthlyAmount.amount;
}

function buildKeepDoorVerdict(
  input: SimulationInput,
  result: SimulationResult,
  keeper: PersonId
): DoorVerdict {
  const doorId: DoorId = keeper === "A" ? "keep_a" : "keep_b";
  const scenario = result.scenarios.find((s) => s.scenario === doorId);
  const keepExisting = scenario?.keepFinancingMode === "keep_existing_loan";

  // Garde du crédit : on ne finance que rachat + frais.
  // Sinon : package CRD + rachat + frais.
  const financingNeeded = keepExisting
    ? (scenario?.newLoanAmount?.amount ??
      scenario?.cashNeeded?.amount ??
      scenario?.soulte?.totalCashNeeded?.amount ??
      0)
    : (scenario?.soulte?.refinanceAmount?.amount ??
      scenario?.cashNeeded?.amount ??
      scenario?.soulte?.totalCashNeeded?.amount ??
      scenario?.soulte?.amount.amount ??
      0);

  const existingCharges =
    (keepExisting ? (scenario?.keptMortgageMonthly?.amount ?? input.monthlyMortgagePayment ?? 0) : 0) +
    childSupportChargeFor(input, keeper);

  const rateSnapshot = getMortgageRateSnapshot(input.options.mortgageDurationYears ?? 20);

  const affordability = computeAffordability({
    incomeMonthly: incomeFor(input, keeper),
    liquidCapital: Math.max(0, result.netWorthByPerson[keeper].amount),
    targetPropertyPrice: financingNeeded,
    existingMonthlyCharges: existingCharges,
    durationYears: rateSnapshot.durationYears,
    maxEffortRatio: 0.35,
  });

  return {
    doorId,
    verdict: affordability.verdict,
    label: DOOR_LABELS[doorId],
    headline: affordability.label,
    detail: affordability.detail,
    monthlyImpact: scenario?.monthlyPaymentEstimate ?? affordability.monthlyPayment,
  };
}

function buildSellDoorVerdict(
  input: SimulationInput,
  result: SimulationResult
): DoorVerdict {
  const postalCode = input.postalCode ?? "75000";
  const surface = input.propertySurface ?? 65;
  const zone = buildZoneMarketSnapshot(postalCode, surface);
  const relocateTarget = round(zone.minPricePerSqm.amount * Math.max(45, surface - 15));
  const sellScenario = result.scenarios.find((s) => s.scenario === "sell");
  const rateSnapshot = getMortgageRateSnapshot(input.options.mortgageDurationYears ?? 20);

  const affA = computeAffordability({
    incomeMonthly: incomeFor(input, "A"),
    liquidCapital: sellScenario?.netWorthByPerson.A.amount ?? 0,
    targetPropertyPrice: relocateTarget,
    existingMonthlyCharges: childSupportChargeFor(input, "A"),
    durationYears: rateSnapshot.durationYears,
  });
  const affB = computeAffordability({
    incomeMonthly: incomeFor(input, "B"),
    liquidCapital: sellScenario?.netWorthByPerson.B.amount ?? 0,
    targetPropertyPrice: relocateTarget,
    existingMonthlyCharges: childSupportChargeFor(input, "B"),
    durationYears: rateSnapshot.durationYears,
  });

  const verdict = worstVerdict(affA.verdict, affB.verdict);
  const headline =
    verdict === "green"
      ? "Relogement accessible dans la zone"
      : verdict === "orange"
        ? "Relogement serré pour au moins une partie"
        : "Relogement difficile dans la zone";

  return {
    doorId: "sell",
    verdict,
    label: DOOR_LABELS.sell,
    headline,
    detail: `Cible relocation ~${Math.round(relocateTarget).toLocaleString("fr-FR")} € · ${affA.detail}`,
    monthlyImpact: affA.monthlyPayment,
  };
}

function buildRentOutDoorVerdict(
  input: SimulationInput,
  result: SimulationResult
): DoorVerdict {
  const rentScenario = result.scenarios.find((s) => s.scenario === "rent_out");
  const netRent = rentScenario?.monthlyPaymentEstimate?.amount ?? 0;
  const postalCode = input.postalCode ?? "75000";
  const surface = input.propertySurface ?? 65;
  const grossRent =
    input.options.monthlyRentOverride && input.options.monthlyRentOverride > 0
      ? round(input.options.monthlyRentOverride)
      : round(rentPerSqm(postalCode) * surface);
  const mortgage = input.liabilities.find((l) => l.type === "mortgage");
  const mortgagePay =
    input.monthlyMortgagePayment && input.monthlyMortgagePayment > 0
      ? input.monthlyMortgagePayment
      : mortgage
        ? estimateMonthlyPayment(
            mortgage.remainingBalance.amount,
            input.options.mortgageRate ?? 0.0385,
            input.options.mortgageDurationYears ?? 20
          ).amount
        : 0;

  const verdict: AffordabilityVerdict =
    netRent >= RENT_GREEN_THRESHOLD
      ? "green"
      : netRent >= 0
        ? "orange"
        : "red";

  const creditLabel =
    input.monthlyMortgagePayment && input.monthlyMortgagePayment > 0
      ? "votre mensualité actuelle"
      : "mensualité marché";

  return {
    doorId: "rent_out",
    verdict,
    label: DOOR_LABELS.rent_out,
    headline:
      verdict === "green"
        ? `Excédent locatif ~${Math.round(netRent).toLocaleString("fr-FR")} €/mois`
        : verdict === "orange"
          ? "Équilibre tendu entre loyer et crédit"
          : "Loyer insuffisant vs crédit restant",
    detail: `Loyer ${Math.round(grossRent).toLocaleString("fr-FR")} € − ${creditLabel} ${Math.round(mortgagePay).toLocaleString("fr-FR")} € − charges ~${CHARGES_ESTIMATE_MONTHLY} € (${postalCode}, ${surface} m²)`,
    monthlyImpact: eur(netRent),
  };
}

/** Verdicts tricolores pour les 4 portes — Strate 2 du funnel. */
export function compileDoorVerdicts(
  input: SimulationInput,
  result: SimulationResult
): DoorVerdictMap {
  return {
    keep_a: buildKeepDoorVerdict(input, result, "A"),
    keep_b: buildKeepDoorVerdict(input, result, "B"),
    sell: buildSellDoorVerdict(input, result),
    rent_out: buildRentOutDoorVerdict(input, result),
  };
}

export { RENT_GREEN_THRESHOLD, CHARGES_ESTIMATE_MONTHLY as RENT_CHARGES_MONTHLY };
