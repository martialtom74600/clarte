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
} from "./affordability.js";
import { getMortgageRateSnapshot } from "./mortgage-rates.js";
import { RENT_GREEN_THRESHOLD } from "./rent-out-cashflow.js";
import { estimateChildSupport } from "./support.js";
import { eur, estimateMonthlyPayment, round } from "./utils.js";

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
  const departing = scenario?.departurePersonId ?? (keeper === "A" ? "B" : "A");

  // Garde du crédit : on ne finance que rachat + frais (+ indemnité).
  // Sinon : package CRD + rachat + frais (+ indemnité).
  const financingNeeded = keepExisting
    ? (scenario?.newLoanAmount?.amount ??
      scenario?.cashNeeded?.amount ??
      scenario?.soulte?.totalCashNeeded?.amount ??
      0)
    : (scenario?.cashNeeded?.amount ??
      scenario?.soulte?.refinanceAmount?.amount ??
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

  if (scenario?.soulte?.negativeEquity || scenario?.negativeEquity) {
    const residual = scenario?.soulte?.residualDebt?.amount ?? 0;
    return {
      doorId,
      verdict: "red",
      label: DOOR_LABELS[doorId],
      headline: "Actif net négatif — dette à partager",
      detail: `Le crédit dépasse la valeur du bien (~${Math.round(residual).toLocaleString("fr-FR")} € de dette résiduelle). Pas de soulte ; anticipez un accord banque et notaire. ${
        scenario?.bankDisclaimer ?? ""
      }`.trim(),
      monthlyImpact: scenario?.monthlyPaymentEstimate ?? affordability.monthlyPayment,
    };
  }

  const departureRelocate =
    scenario?.departureRelocateVerdict ??
    scenario?.relocateVerdictByPerson?.[departing] ??
    "orange";
  const combined = worstVerdict(affordability.verdict, departureRelocate);

  const departureCapital = scenario?.departureCapital?.amount ?? scenario?.soulte?.amount.amount ?? 0;
  const relocateTarget = scenario?.relocateTarget?.amount ?? 0;
  const indemnity = scenario?.occupationIndemnity?.amount ?? 0;

  const relocateNote =
    departureRelocate === "green"
      ? `Partant : capital ${Math.round(departureCapital).toLocaleString("fr-FR")} € — relogement zone tenable (cible ~${Math.round(relocateTarget).toLocaleString("fr-FR")} €).`
      : departureRelocate === "orange"
        ? `Partant : capital ${Math.round(departureCapital).toLocaleString("fr-FR")} € — relogement zone serré (cible ~${Math.round(relocateTarget).toLocaleString("fr-FR")} €).`
        : `Partant : capital ${Math.round(departureCapital).toLocaleString("fr-FR")} € — relogement zone difficile (cible ~${Math.round(relocateTarget).toLocaleString("fr-FR")} €).`;

  const occupationNote =
    indemnity > 0 && scenario?.occupationNote ? ` ${scenario.occupationNote}` : "";

  const bankNote = scenario?.bankDisclaimer ? ` ${scenario.bankDisclaimer}` : "";

  const headline =
    combined === "green"
      ? "Rachat et relogement du partant tenables"
      : combined === "orange"
        ? "Rachat ou relogement du partant serré"
        : departureRelocate === "red" && affordability.verdict !== "red"
          ? "Financement ok, mais partant sans relogement zone"
          : affordability.label;

  return {
    doorId,
    verdict: combined,
    label: DOOR_LABELS[doorId],
    headline,
    detail: `${affordability.detail} ${relocateNote}${occupationNote}${bankNote}`.trim(),
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

  const proceedsA =
    sellScenario?.saleProceedsByPerson?.A.amount ??
    sellScenario?.netWorthByPerson.A.amount ??
    0;
  const proceedsB =
    sellScenario?.saleProceedsByPerson?.B.amount ??
    sellScenario?.netWorthByPerson.B.amount ??
    0;

  const affA = computeAffordability({
    incomeMonthly: incomeFor(input, "A"),
    liquidCapital: Math.max(0, proceedsA),
    targetPropertyPrice: relocateTarget,
    existingMonthlyCharges: childSupportChargeFor(input, "A"),
    durationYears: rateSnapshot.durationYears,
  });
  const affB = computeAffordability({
    incomeMonthly: incomeFor(input, "B"),
    liquidCapital: Math.max(0, proceedsB),
    targetPropertyPrice: relocateTarget,
    existingMonthlyCharges: childSupportChargeFor(input, "B"),
    durationYears: rateSnapshot.durationYears,
  });

  const agency = sellScenario?.agencyFeesEstimate?.amount ?? 0;
  const diagnostics = sellScenario?.diagnosticsEstimate?.amount ?? 0;
  const cgiNote = sellScenario?.capitalGainsNote ?? "";

  if (sellScenario?.negativeEquity) {
    const shortfall = Math.abs(sellScenario.saleNetProceeds?.amount ?? 0);
    return {
      doorId: "sell",
      verdict: "red",
      label: DOOR_LABELS.sell,
      headline: "Actif net négatif — dette à partager",
      detail: `Après agence + diagnostics et crédit, dette ~${Math.round(shortfall).toLocaleString("fr-FR")} € à partager (Vous ${Math.round(Math.abs(proceedsA)).toLocaleString("fr-FR")} € · Autre ${Math.round(Math.abs(proceedsB)).toLocaleString("fr-FR")} €). ${cgiNote}`,
      monthlyImpact: affA.monthlyPayment,
    };
  }

  const verdict =
    sellScenario?.relocateVerdictByPerson != null
      ? worstVerdict(
          sellScenario.relocateVerdictByPerson.A,
          sellScenario.relocateVerdictByPerson.B
        )
      : worstVerdict(affA.verdict, affB.verdict);

  const headline =
    verdict === "green"
      ? "Relogement accessible pour les deux"
      : verdict === "orange"
        ? "Relogement serré pour au moins une partie"
        : "Relogement difficile dans la zone";

  return {
    doorId: "sell",
    verdict,
    label: DOOR_LABELS.sell,
    headline,
    detail: `Net vendeur Vous ${Math.round(proceedsA).toLocaleString("fr-FR")} € · Autre ${Math.round(proceedsB).toLocaleString("fr-FR")} € (agence ${Math.round(agency).toLocaleString("fr-FR")} € + diagnostics ${Math.round(diagnostics).toLocaleString("fr-FR")} €). Cible zone ~${Math.round(relocateTarget).toLocaleString("fr-FR")} € · Vous ${affA.verdict} · Autre ${affB.verdict}. ${cgiNote}`,
    monthlyImpact: affA.monthlyPayment,
  };
}

function buildRentOutDoorVerdict(
  input: SimulationInput,
  result: SimulationResult
): DoorVerdict {
  const rentScenario = result.scenarios.find((s) => s.scenario === "rent_out");
  const bd = rentScenario?.rentOutBreakdown;
  const netRent = bd?.netCashflow.amount ?? rentScenario?.monthlyPaymentEstimate?.amount ?? 0;
  const postalCode = input.postalCode ?? "75000";
  const surface = input.propertySurface ?? 65;

  const verdict: AffordabilityVerdict =
    netRent >= RENT_GREEN_THRESHOLD
      ? "green"
      : netRent >= 0
        ? "orange"
        : "red";

  const detail =
    rentScenario?.rentOutFormulaDetail ??
    `Cashflow net ${Math.round(netRent).toLocaleString("fr-FR")} €/mois (${postalCode}, ${surface} m²)`;

  return {
    doorId: "rent_out",
    verdict,
    label: DOOR_LABELS.rent_out,
    headline:
      verdict === "green"
        ? `Cashflow net ~${Math.round(netRent).toLocaleString("fr-FR")} €/mois`
        : verdict === "orange"
          ? "Équilibre tendu après charges et impôts"
          : "Cashflow locatif insuffisant (charges + impôts)",
    detail,
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

export { RENT_GREEN_THRESHOLD };
/** @deprecated Ancien forfait 180 € — remplacé par TF + PNO + vacance + gestion. */
export const RENT_CHARGES_MONTHLY = 0;
