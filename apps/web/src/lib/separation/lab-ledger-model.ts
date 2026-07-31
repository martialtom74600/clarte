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
  const negativeEquity = net < 0 || scenario?.negativeEquity === true;

  const lines: LedgerLine[] = [
    { id: "property", label: "Valeur du bien", amount: footprint.propertyValue },
    {
      id: "mortgage",
      label: "Crédit restant",
      amount: footprint.mortgageRemaining,
      tone: "subtract",
    },
    {
      id: "net",
      label: negativeEquity ? "Actif net négatif — dette à partager" : "Valeur nette du bien",
      amount: net,
      tone: "highlight",
    },
  ];

  if (lab.enabledLevers.includes("initial_contributions") && lab.overrides.initial_contributions) {
    const { contributionA, contributionB } = lab.overrides.initial_contributions;
    if (contributionA + contributionB > 0) {
      const isCommunity =
        assumptions.status === "marriage" &&
        (assumptions.marriageRegime === "communaute_legale" ||
          assumptions.marriageRegime === "communaute_universelle");
      const mode = scenario?.soulte?.contributionMode;
      lines.push({
        id: "contributions",
        label: isCommunity || mode === "recompense"
          ? "Récompenses d'apports art. 1469 (avant partage)"
          : mode === "creance"
            ? "Créances d'apport art. 815-13 (prélèvement avant partage)"
            : `Apports initiaux (vous ${Math.round((contributionA / (contributionA + contributionB)) * 100)} % · autre ${Math.round((contributionB / (contributionA + contributionB)) * 100)} %)`,
        amount: contributionA + contributionB,
        tone: "neutral",
      });
    }
  }

  const soulteLabel = negativeEquity
    ? "Soulte (aucune — equity négative)"
    : doorId === "keep_a"
      ? "Vous devez verser"
      : "Vous recevrez";
  const totalCashLabel =
    doorId === "keep_a" ? "Total à prévoir (rachat + frais d'acte)" : "Total que l'autre doit prévoir";
  const keepExisting = scenario?.keepFinancingMode === "keep_existing_loan";
  const newLoan = scenario?.newLoanAmount?.amount ?? totalCash;
  const newLoanMonthly = scenario?.newLoanMonthly?.amount ?? 0;
  const keptMonthly = scenario?.keptMortgageMonthly?.amount ?? 0;

  const indemnity = scenario?.occupationIndemnity?.amount ?? 0;
  const buyoutTransfer = scenario?.buyoutTransferTotal?.amount ?? soulte + indemnity;
  const departureCapital = scenario?.departureCapital?.amount ?? buyoutTransfer;
  const relocateTarget = scenario?.relocateTarget?.amount ?? 0;
  const cashWithIndemnity = totalCash + indemnity;

  lines.push(
    { id: "soulte", label: soulteLabel, amount: soulte, tone: "highlight" }
  );

  if (indemnity > 0 && (scenario?.occupationMonths ?? 0) > 0) {
    const months = scenario!.occupationMonths!;
    const halfRent = scenario?.occupationMonthlyHalfRent?.amount ?? indemnity / months;
    lines.push(
      {
        id: "occupation-half-rent",
        label: `Demi-loyer × ${months} mois d'occupation exclusive`,
        amount: Math.round(halfRent),
        tone: "neutral",
        suffix: "/mois",
      },
      {
        id: "occupation-indemnity",
        label: "Indemnité d'occupation (imputée sur le rachat)",
        amount: indemnity,
        tone: "highlight",
      },
      {
        id: "buyout-transfer",
        label: doorId === "keep_a" ? "Transfert total (soulte + indemnité)" : "Vous récupérez au total",
        amount: buyoutTransfer,
        tone: "total",
      }
    );
  }

  lines.push(
    {
      id: "notary",
      label: "Droit de partage (CGI 746) + émoluments ~1,5 %",
      amount: notary,
      tone: "subtract",
    },
    {
      id: "total-cash",
      label: totalCashLabel,
      amount: cashWithIndemnity,
      tone: "highlight",
    },
    {
      id: "departure-capital",
      label: doorId === "keep_a" ? "Capital net récupéré par l'autre" : "Votre capital net récupéré",
      amount: departureCapital,
      tone: "highlight",
    }
  );

  if (relocateTarget > 0) {
    lines.push({
      id: "relocate-target",
      label: "Cible relogement zone (prix × surface)",
      amount: relocateTarget,
      tone: "neutral",
    });
  }

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

  const departureRelocate =
    scenario?.departureRelocateVerdict ??
    scenario?.relocateVerdictByPerson?.[scenario?.departurePersonId ?? (doorId === "keep_a" ? "B" : "A")];

  const footerParts = [
    negativeEquity ? "Actif net négatif — dette à partager." : null,
    scenario?.occupationNote,
    departureRelocate
      ? `Relogement du partant : ${departureRelocate}.`
      : null,
    keepExisting ? scenario?.bankDisclaimer : null,
    verdict?.detail,
  ].filter(Boolean);

  return {
    doorId,
    doorTitle: DOOR_TITLES[doorId],
    verdict,
    lines,
    // Newlines : le détail HCSF (endettement / finançable) est mis en avant dans le ledger UI.
    footer: footerParts.join("\n") || undefined,
  };
}

function buildSellLedger(
  footprint: FootprintState,
  lab: LabState,
  result: SimulationResult,
  verdict: DoorVerdictMap[DoorId] | null
): LabLedgerModel {
  const sell = scenarioFor(result, "sell");
  const agency = sell?.agencyFeesEstimate?.amount ?? footprint.propertyValue * 0.05;
  const diagnostics = sell?.diagnosticsEstimate?.amount ?? 1800;
  const sellingCosts = sell?.sellingCostsEstimate?.amount ?? agency + diagnostics;
  const saleNet =
    sell?.saleNetProceeds?.amount ??
    footprint.propertyValue - sellingCosts - footprint.mortgageRemaining;
  const you = sell?.saleProceedsByPerson?.A.amount ?? saleNet / 2;
  const other = sell?.saleProceedsByPerson?.B.amount ?? saleNet / 2;
  const negativeEquity = saleNet < 0 || sell?.negativeEquity === true;
  const relocateTarget = sell?.relocateTarget?.amount;

  const lines: LedgerLine[] = [
    { id: "property", label: "Valeur du bien", amount: footprint.propertyValue },
    {
      id: "agency",
      label: "Frais d'agence (~5 %)",
      amount: agency,
      tone: "subtract",
    },
    {
      id: "diagnostics",
      label: "Diagnostics obligatoires (forfait)",
      amount: diagnostics,
      tone: "subtract",
    },
    {
      id: "mortgage",
      label: "Crédit restant",
      amount: footprint.mortgageRemaining,
      tone: "subtract",
    },
    {
      id: "net",
      label: negativeEquity
        ? "Actif net négatif — dette à partager"
        : "Produit net de vente (après frais)",
      amount: saleNet,
      tone: "highlight",
    },
    {
      id: "you",
      label: negativeEquity ? "Votre quote-part de dette" : "Votre part nette",
      amount: you,
      tone: "total",
    },
    {
      id: "other",
      label: negativeEquity ? "Quote-part de dette de l'autre" : "Part nette de l'autre",
      amount: other,
      tone: "total",
    },
  ];

  if (relocateTarget != null && relocateTarget > 0) {
    lines.push({
      id: "relocate-target",
      label: "Cible relogement zone (prix × surface)",
      amount: relocateTarget,
      tone: "neutral",
    });
  }

  const pension = childSupportLine(footprint, lab);
  if (pension) lines.push(pension);

  const footerParts = [
    sell?.capitalGainsNote,
    sell?.relocateVerdictByPerson
      ? `Relogement zone — Vous : ${sell.relocateVerdictByPerson.A} · Autre : ${sell.relocateVerdictByPerson.B}.`
      : null,
    verdict?.detail,
  ].filter(Boolean);

  return {
    doorId: "sell",
    doorTitle: DOOR_TITLES.sell,
    verdict,
    lines,
    footer: footerParts.join(" ") || undefined,
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
  const bd = scenario?.rentOutBreakdown;
  const net = bd?.netCashflow.amount ?? scenario?.monthlyPaymentEstimate?.amount ?? 0;
  const mortgagePay =
    bd?.mortgagePayment.amount ?? effectiveMortgagePayment(footprint, assumptions, lab);

  const lines: LedgerLine[] = [
    {
      id: "rent",
      label: "Loyer brut estimé (zone × surface)",
      amount: Math.round(bd?.grossRent.amount ?? 0),
    },
    {
      id: "vacancy",
      label: `Vacance locative (${Math.round((bd?.vacancyRate ?? 0.06) * 100)} %)`,
      amount: Math.round(bd?.vacancyProvision.amount ?? 0),
      tone: "subtract",
    },
    {
      id: "effective-rent",
      label: "Loyer effectif",
      amount: Math.round(bd?.effectiveRent.amount ?? 0),
      tone: "neutral",
    },
    {
      id: "mortgage-pay",
      label: lab.enabledLevers.includes("historical_mortgage_rate")
        ? "Mensualité crédit (votre taux)"
        : "Mensualité crédit (marché)",
      amount: Math.round(mortgagePay),
      tone: "subtract",
    },
    {
      id: "property-tax",
      label: "Taxe foncière (mensualisée)",
      amount: Math.round(bd?.propertyTaxMonthly.amount ?? 0),
      tone: "subtract",
    },
    {
      id: "pno",
      label: "Assurance PNO",
      amount: Math.round(bd?.pnoMonthly.amount ?? 0),
      tone: "subtract",
    },
    {
      id: "management",
      label: `Gestion déléguée (${Math.round((bd?.managementFeeRate ?? 0) * 100)} %)`,
      amount: Math.round(bd?.managementFees.amount ?? 0),
      tone: "subtract",
    },
    {
      id: "tax",
      label: "Impôts micro-foncier (IR + PS, abatt. 30 %)",
      amount: Math.round(bd?.incomeTaxEstimate.amount ?? 0),
      tone: "subtract",
    },
    {
      id: "net",
      label: "Cashflow net réel",
      amount: Math.round(net),
      tone: "total",
      suffix: "/mois",
    },
  ];

  if (!lab.enabledLevers.includes("historical_mortgage_rate") && footprint.mortgageRemaining > 0) {
    lines.splice(4, 0, {
      id: "market-ref",
      label: "Réf. mensualité marché",
      amount: defaultMortgagePayment(footprint, assumptions),
      tone: "neutral",
    });
  }

  const pension = childSupportLine(footprint, lab);
  if (pension) lines.push(pension);

  const footerParts = [
    scenario?.rentOutFormulaDetail,
    verdict?.headline
      ? `Feu ${verdict.verdict} — ${verdict.headline}`
      : null,
    input.postalCode ? `Zone ${input.postalCode}` : null,
  ].filter(Boolean);

  return {
    doorId: "rent_out",
    doorTitle: DOOR_TITLES.rent_out,
    verdict,
    lines,
    footer: footerParts.join(" · ") || undefined,
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
