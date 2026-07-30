import type { DoorId, DoorVerdictMap, SimulationResult } from "@separation/schemas";
import { estimateChildSupport, estimateMonthlyPayment } from "@separation/engine";
import type { AssumptionsState, FootprintState, LabState } from "./separation-types";
import { compileSimulationInput } from "./compile-simulation-input";

export interface LedgerLine {
  id: string;
  label: string;
  amount: number;
  tone?: "neutral" | "subtract" | "highlight" | "total";
  suffix?: string;
}

export interface LabLedgerModel {
  doorId: DoorId;
  doorTitle: string;
  verdict: DoorVerdictMap[DoorId] | null;
  lines: LedgerLine[];
  footer?: string;
}

const DOOR_TITLES: Record<DoorId, string> = {
  keep_a: "Vous rachetez",
  keep_b: "L'autre rachète",
  sell: "Vendre",
  rent_out: "Garder et louer",
};

function scenarioFor(result: SimulationResult, doorId: DoorId) {
  return result.scenarios.find((s) => s.scenario === doorId);
}

function defaultMortgagePayment(footprint: FootprintState, assumptions: AssumptionsState): number {
  if (footprint.mortgageRemaining <= 0) return 0;
  return estimateMonthlyPayment(
    footprint.mortgageRemaining,
    assumptions.mortgageRate,
    assumptions.mortgageDurationYears
  ).amount;
}

function effectiveMortgagePayment(
  footprint: FootprintState,
  assumptions: AssumptionsState,
  lab: LabState
): number {
  if (
    lab.enabledLevers.includes("historical_mortgage_rate") &&
    lab.overrides.historical_mortgage_rate
  ) {
    return lab.overrides.historical_mortgage_rate.monthlyMortgagePayment;
  }
  return defaultMortgagePayment(footprint, assumptions);
}

function childSupportLine(
  footprint: FootprintState,
  lab: LabState
): LedgerLine | null {
  if (!lab.enabledLevers.includes("children_impact")) return null;
  const cfg = lab.overrides.children_impact;
  if (!cfg?.hasMinorChildren || cfg.numberOfChildren <= 0) return null;

  const support = estimateChildSupport({
    payerIncomeMonthly: footprint.incomeA,
    recipientIncomeMonthly: footprint.incomeB,
    numberOfChildren: cfg.numberOfChildren,
    custodyType: cfg.custodyType,
  });

  if (!support) return null;

  return {
    id: "child-support",
    label: `Budget pour les enfants (${support.payerId === "A" ? "versé" : "reçu"} par ${support.payerId === "A" ? "vous" : "l'autre"})`,
    amount: support.monthlyAmount.amount,
    tone: "subtract",
    suffix: "/mois",
  };
}

function buildKeepLedger(
  doorId: "keep_a" | "keep_b",
  footprint: FootprintState,
  assumptions: AssumptionsState,
  lab: LabState,
  result: SimulationResult,
  verdict: DoorVerdictMap[DoorId] | null
): LabLedgerModel {
  const net = footprint.propertyValue - footprint.mortgageRemaining;
  const scenario = scenarioFor(result, doorId);
  const soulte = scenario?.soulte?.amount.amount ?? 0;
  const notary = scenario?.soulte?.notaryFeesEstimate?.amount ?? 0;
  const totalCash = scenario?.soulte?.totalCashNeeded?.amount ?? soulte;
  const monthly = scenario?.monthlyPaymentEstimate?.amount ?? 0;

  const lines: LedgerLine[] = [
    { id: "property", label: "Valeur du bien", amount: footprint.propertyValue },
    {
      id: "mortgage",
      label: "Crédit restant",
      amount: footprint.mortgageRemaining,
      tone: "subtract",
    },
    { id: "net", label: "Valeur nette du bien", amount: net, tone: "highlight" },
  ];

  if (lab.enabledLevers.includes("initial_contributions") && lab.overrides.initial_contributions) {
    const { contributionA, contributionB } = lab.overrides.initial_contributions;
    if (contributionA + contributionB > 0) {
      const isCommunity =
        assumptions.status === "marriage" &&
        (assumptions.marriageRegime === "communaute_legale" ||
          assumptions.marriageRegime === "communaute_universelle");
      lines.push({
        id: "contributions",
        label: isCommunity
          ? "Récompenses d'apports (à régler avant partage)"
          : `Apports initiaux (vous ${Math.round((contributionA / (contributionA + contributionB)) * 100)} % · autre ${Math.round((contributionB / (contributionA + contributionB)) * 100)} %)`,
        amount: contributionA + contributionB,
        tone: "neutral",
      });
    }
  }

  const soulteLabel =
    doorId === "keep_a" ? "Vous devez verser" : "Vous recevrez";
  const totalCashLabel =
    doorId === "keep_a" ? "Total à prévoir (rachat + frais)" : "Total que l'autre doit prévoir";
  const keepExisting = scenario?.keepFinancingMode === "keep_existing_loan";
  const newLoan = scenario?.newLoanAmount?.amount ?? totalCash;
  const newLoanMonthly = scenario?.newLoanMonthly?.amount ?? 0;
  const keptMonthly = scenario?.keptMortgageMonthly?.amount ?? 0;

  lines.push(
    { id: "soulte", label: soulteLabel, amount: soulte, tone: "highlight" },
    {
      id: "notary",
      label: "Droit de partage & frais d'acte",
      amount: notary,
      tone: "subtract",
    },
    { id: "total-cash", label: totalCashLabel, amount: totalCash, tone: "highlight" }
  );

  if (keepExisting) {
    lines.push(
      {
        id: "kept-mortgage",
        label: "Crédit actuel conservé (votre mensualité)",
        amount: keptMonthly,
        tone: "neutral",
        suffix: "/mois",
      },
      {
        id: "new-loan",
        label: "Nouveau prêt (rachat + frais seulement)",
        amount: newLoan,
        tone: "total",
      },
      {
        id: "new-loan-monthly",
        label: "Mensualité de ce nouveau prêt",
        amount: newLoanMonthly,
        tone: "neutral",
        suffix: "/mois",
      },
      {
        id: "monthly",
        label: "Total à rembourser chaque mois",
        amount: monthly,
        tone: "total",
        suffix: "/mois",
      }
    );
  } else {
    lines.push(
      {
        id: "refinance",
        label: "Nouveau crédit estimé (CRD + rachat + frais)",
        amount: newLoan,
        tone: "total",
      },
      {
        id: "monthly",
        label: "Mensualité de ce nouveau crédit",
        amount: monthly,
        tone: "neutral",
        suffix: "/mois",
      }
    );
  }

  const pension = childSupportLine(footprint, lab);
  if (pension) lines.push(pension);

  return {
    doorId,
    doorTitle: DOOR_TITLES[doorId],
    verdict,
    lines,
    footer: verdict?.detail,
  };
}

function buildSellLedger(
  footprint: FootprintState,
  lab: LabState,
  result: SimulationResult,
  verdict: DoorVerdictMap[DoorId] | null
): LabLedgerModel {
  const net = footprint.propertyValue - footprint.mortgageRemaining;
  const proceeds = scenarioFor(result, "sell")?.netWorthByPerson.A.amount ?? net / 2;

  const lines: LedgerLine[] = [
    { id: "property", label: "Valeur du bien", amount: footprint.propertyValue },
    {
      id: "mortgage",
      label: "Crédit restant",
      amount: footprint.mortgageRemaining,
      tone: "subtract",
    },
    { id: "net", label: "Produit net de vente", amount: net, tone: "highlight" },
    { id: "each", label: "Votre part", amount: proceeds, tone: "total" },
  ];

  const pension = childSupportLine(footprint, lab);
  if (pension) lines.push(pension);

  return {
    doorId: "sell",
    doorTitle: DOOR_TITLES.sell,
    verdict,
    lines,
    footer: verdict?.detail,
  };
}

function buildRentLedger(
  footprint: FootprintState,
  assumptions: AssumptionsState,
  lab: LabState,
  result: SimulationResult,
  verdict: DoorVerdictMap[DoorId] | null
): LabLedgerModel {
  const input = compileSimulationInput({ footprint, assumptions, lab });
  const scenario = scenarioFor(result, "rent_out");
  const net = scenario?.monthlyPaymentEstimate?.amount ?? 0;
  const mortgagePay = effectiveMortgagePayment(footprint, assumptions, lab);
  const grossRent = net + mortgagePay + 180;

  const lines: LedgerLine[] = [
    { id: "rent", label: "Loyer estimé", amount: Math.round(grossRent) },
    {
      id: "mortgage-pay",
      label: lab.enabledLevers.includes("historical_mortgage_rate")
        ? "Mensualité crédit (votre taux)"
        : "Mensualité crédit (marché)",
      amount: mortgagePay,
      tone: "subtract",
    },
    { id: "charges", label: "Charges estimées", amount: 180, tone: "subtract" },
    { id: "net", label: "Excédent mensuel net", amount: net, tone: "total", suffix: "/mois" },
  ];

  if (!lab.enabledLevers.includes("historical_mortgage_rate") && footprint.mortgageRemaining > 0) {
    lines.splice(2, 0, {
      id: "market-ref",
      label: "Réf. mensualité marché",
      amount: defaultMortgagePayment(footprint, assumptions),
      tone: "neutral",
    });
  }

  const pension = childSupportLine(footprint, lab);
  if (pension) lines.push(pension);

  return {
    doorId: "rent_out",
    doorTitle: DOOR_TITLES.rent_out,
    verdict,
    lines,
    footer: verdict?.detail ?? input.postalCode,
  };
}

export function buildLabLedger(params: {
  doorId: DoorId;
  footprint: FootprintState;
  assumptions: AssumptionsState;
  lab: LabState;
  result: SimulationResult | null;
  doorVerdicts: DoorVerdictMap | null;
}): LabLedgerModel | null {
  const { doorId, footprint, assumptions, lab, result, doorVerdicts } = params;
  if (!result || !doorVerdicts) return null;

  const verdict = doorVerdicts[doorId] ?? null;

  switch (doorId) {
    case "keep_a":
    case "keep_b":
      return buildKeepLedger(doorId, footprint, assumptions, lab, result, verdict);
    case "sell":
      return buildSellLedger(footprint, lab, result, verdict);
    case "rent_out":
      return buildRentLedger(footprint, assumptions, lab, result, verdict);
    default:
      return null;
  }
}

export function ledgerFingerprint(model: LabLedgerModel | null): string {
  if (!model) return "";
  return JSON.stringify({
    v: model.verdict?.verdict,
    lines: model.lines.map((l) => [l.id, l.amount]),
  });
}

export { defaultMortgagePayment };
