import type { AffordabilityVerdict, DoorId, DoorVerdictMap, SimulationResult } from "@separation/schemas";
import { estimateChildSupport, estimateMonthlyPayment, RENT_GREEN_THRESHOLD } from "@separation/engine";
import type { AssumptionsState, FootprintState, LabState } from "./separation-types";
import { compileSimulationInput } from "./compile-simulation-input";
import type { LedgerSectionId } from "./lab-ledger-sections";
import { normalizeKeepFooterDetail } from "./lab-ledger-insights";
import { estimateRelocateTarget, relocateMonthlyLine } from "./lab-ledger-parity";

export interface LedgerLine {
  id: string;
  label: string;
  amount: number;
  tone?: "neutral" | "subtract" | "highlight" | "total";
  suffix?: string;
  sectionId?: LedgerSectionId;
  /** Courte explication sous le libellé (jargon évité). */
  hint?: string;
}

export interface LabLedgerModel {
  doorId: DoorId;
  doorTitle: string;
  verdict: DoorVerdictMap[DoorId] | null;
  lines: LedgerLine[];
  footer?: string;
  /** Note d'avertissement (ex. accord banque) — une seule fois, hors footer principal. */
  warningNote?: string;
  /** Message pédagogique court (ex. dépassement 35 %) — affiché dans « Ce que ça signifie ». */
  contextNote?: string;
}

const NOTARY_FEES_HINT =
  "Droit de partage (CGI 746) et émoluments sur le patrimoine net";

function buildKeepContextNote(
  doorId: "keep_a" | "keep_b",
  verdict: DoorVerdictMap[DoorId] | null,
  negativeEquity: boolean
): string | undefined {
  if (negativeEquity) {
    return "Le crédit dépasse la valeur du bien — la dette se partage, sans rachat classique.";
  }
  if (!verdict) return undefined;
  if (verdict.verdict === "green") {
    return doorId === "keep_b"
      ? "Le rachat par l'autre et votre relogement restent tenables dans la zone."
      : "Votre rachat et le relogement de l'autre restent tenables dans la zone.";
  }
  if (verdict.verdict === "orange") {
    return doorId === "keep_b"
      ? "Projet serré : l'autre doit convaincre la banque, et le relogement reste juste."
      : "Projet serré : convaincre la banque, et le relogement du partant reste juste.";
  }
  return undefined;
}

function buildRentContextNote(netMonthly: number): string | undefined {
  if (netMonthly < 0) {
    return "Le loyer ne couvre pas toutes les charges : vous complétez de votre poche chaque mois.";
  }
  if (netMonthly < RENT_GREEN_THRESHOLD) {
    return "Le loyer couvre à peine les charges : peu de marge de sécurité.";
  }
  return "Le loyer dépasse les charges : il reste un excédent mensuel après impôts.";
}

function buildSellContextNote(
  relocateVerdict: { A: AffordabilityVerdict; B: AffordabilityVerdict } | undefined,
  negativeEquity: boolean
): string | undefined {
  if (negativeEquity) {
    return "La vente ne couvre pas le crédit : la dette restante se partage entre vous.";
  }
  if (!relocateVerdict) return undefined;
  const worst = [relocateVerdict.A, relocateVerdict.B].sort(
    (a, b) => ({ red: 0, orange: 1, green: 2 }[a] - { red: 0, orange: 1, green: 2 }[b])
  )[0];
  if (worst === "red") {
    return "Le produit de la vente ne suffit pas, pour au moins l'un de vous, à financer un logement équivalent dans le quartier.";
  }
  if (worst === "orange") {
    return "Le relogement dans le quartier sera serré pour au moins l'un de vous.";
  }
  return "Vos parts nettes permettent, en principe, de vous reloger dans le quartier.";
}

const RELOCATE_VERDICT_LABELS: Record<AffordabilityVerdict, string> = {
  green: "Tenable",
  orange: "Serré",
  red: "Difficile",
};

/** Traduit red/orange/green pour l'UI (jamais la valeur brute). */
export function formatAffordabilityVerdictLabel(verdict: AffordabilityVerdict): string {
  return RELOCATE_VERDICT_LABELS[verdict];
}

function stripDisclaimerFromText(text: string, disclaimer: string): string {
  if (!text.includes(disclaimer)) return text.trim();
  return text.replace(disclaimer, "").replace(/\s{2,}/g, " ").trim();
}

function buildKeepFooter(params: {
  doorId: "keep_a" | "keep_b";
  negativeEquity: boolean;
  verdictDetail?: string;
  bankDisclaimer?: string | null;
}): Pick<LabLedgerModel, "footer" | "warningNote"> {
  const warningNote =
    params.bankDisclaimer && params.bankDisclaimer.length > 0
      ? params.bankDisclaimer
      : undefined;

  let body = params.verdictDetail ?? "";
  if (warningNote) {
    body = stripDisclaimerFromText(body, warningNote);
  }
  body = normalizeKeepFooterDetail(body, params.doorId);

  const footerParts = [
    params.negativeEquity ? "Actif net négatif — dette à partager." : null,
    body || null,
  ].filter(Boolean);

  return {
    footer: footerParts.join("\n") || undefined,
    warningNote,
  };
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
    label: `Budget enfants (${support.payerId === "A" ? "versé" : "reçu"} par ${support.payerId === "A" ? "vous" : "l'autre"})`,
    amount: support.monthlyAmount.amount,
    tone: "subtract",
    suffix: "/mois",
    sectionId: "enfants",
    hint: "Estimation mensuelle — à ajuster selon votre situation",
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
    {
      id: "property",
      label: "Valeur du bien",
      amount: footprint.propertyValue,
      sectionId: "bien",
      hint: "Estimation actuelle du logement",
    },
    {
      id: "mortgage",
      label: "Prêt immobilier restant",
      amount: footprint.mortgageRemaining,
      tone: "subtract",
      sectionId: "bien",
      hint: "Ce qu'il reste à rembourser à la banque",
    },
    {
      id: "net",
      label: negativeEquity
        ? "Dette nette à partager"
        : "Patrimoine net du logement",
      amount: net,
      tone: "highlight",
      sectionId: "bien",
      hint: negativeEquity
        ? "Le crédit dépasse la valeur — la dette se partage"
        : "Valeur du bien moins le crédit restant",
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
          ? "Apports remboursés avant le partage"
          : mode === "creance"
            ? "Apports déduits avant le partage"
            : `Apports initiaux (vous ${Math.round((contributionA / (contributionA + contributionB)) * 100)} % · autre ${Math.round((contributionB / (contributionA + contributionB)) * 100)} %)`,
        amount: contributionA + contributionB,
        tone: "neutral",
        sectionId: "bien",
        hint: "Argent investi au départ — pris en compte avant de partager",
      });
    }
  }

  const soulteLabel = negativeEquity
    ? "Rachat de parts (impossible — dette nette)"
    : doorId === "keep_a"
      ? "Vous payez à l'autre"
      : "Vous recevez de l'autre";
  const totalCashLabel =
    doorId === "keep_a"
      ? "Total à sortir (rachat + notaire)"
      : "Total que l'autre doit prévoir";
  const keepExisting = scenario?.keepFinancingMode === "keep_existing_loan";
  const newLoan = scenario?.newLoanAmount?.amount ?? totalCash;
  const newLoanMonthly = scenario?.newLoanMonthly?.amount ?? 0;
  const keptMonthly = scenario?.keptMortgageMonthly?.amount ?? 0;

  const indemnity = scenario?.occupationIndemnity?.amount ?? 0;
  const buyoutTransfer = scenario?.buyoutTransferTotal?.amount ?? soulte + indemnity;
  const departureCapital = scenario?.departureCapital?.amount ?? buyoutTransfer;
  const relocateTarget = scenario?.relocateTarget?.amount ?? 0;
  const cashWithIndemnity = totalCash + indemnity;

  lines.push({
    id: "soulte",
    label: soulteLabel,
    amount: soulte,
    tone: "highlight",
    sectionId: "echange",
    hint: "Montant pour racheter la part de l'autre",
  });

  if (indemnity > 0 && (scenario?.occupationMonths ?? 0) > 0) {
    const months = scenario!.occupationMonths!;
    const halfRent = scenario?.occupationMonthlyHalfRent?.amount ?? indemnity / months;
    lines.push(
      {
        id: "occupation-half-rent",
        label: `Loyer d'occupation (demi-loyer)`,
        amount: Math.round(halfRent),
        tone: "neutral",
        suffix: "/mois",
        sectionId: "echange",
        hint: `Pendant ${months} mois d'occupation exclusive`,
      },
      {
        id: "occupation-indemnity",
        label: "Total occupation (inclus dans le rachat)",
        amount: indemnity,
        tone: "highlight",
        sectionId: "echange",
        hint: "Indemnité versée à l'autre pour l'occupation exclusive",
      },
      {
        id: "buyout-transfer",
        label: doorId === "keep_a" ? "Montant total à l'autre" : "Vous récupérez au total",
        amount: buyoutTransfer,
        tone: "total",
        sectionId: "echange",
        hint: "Rachat de parts + indemnité d'occupation le cas échéant",
      }
    );
  }

  lines.push(
    {
      id: "notary",
      label: "Frais de notaire pour le rachat",
      amount: notary,
      tone: "subtract",
      sectionId: "echange",
      hint: NOTARY_FEES_HINT,
    },
    {
      id: "total-cash",
      label: totalCashLabel,
      amount: cashWithIndemnity,
      tone: "highlight",
      sectionId: "echange",
      hint: "Rachat + frais de notaire (+ indemnité d'occupation le cas échéant)",
    },
    {
      id: "departure-capital",
      label: doorId === "keep_a" ? "Ce que l'autre repart avec" : "Votre argent récupéré",
      amount: departureCapital,
      tone: "highlight",
      sectionId: "echange",
      hint: "Capital disponible pour se reloger",
    }
  );

  if (relocateTarget > 0) {
    lines.push({
      id: "relocate-target",
      label: "Prix d'un logement équivalent dans votre quartier",
      amount: relocateTarget,
      tone: "neutral",
      sectionId: "relogement",
      hint: "Repère local pour évaluer le relogement",
    });

    const departingIncome = doorId === "keep_a" ? footprint.incomeB : footprint.incomeA;
    const relocateMonthly = relocateMonthlyLine({
      id: "relocate-monthly",
      label:
        doorId === "keep_a"
          ? "Mensualité de relogement (autre)"
          : "Mensualité de relogement (vous)",
      incomeMonthly: departingIncome,
      liquidCapital: departureCapital,
      targetPrice: relocateTarget,
      sectionId: "relogement",
    });
    if (relocateMonthly) lines.push(relocateMonthly);
  }

  if (keepExisting) {
    lines.push(
      {
        id: "kept-mortgage",
        label:
          doorId === "keep_a"
            ? "Votre crédit actuel (conservé)"
            : "Crédit actuel conservé par l'autre",
        amount: keptMonthly,
        tone: "neutral",
        suffix: "/mois",
        sectionId: "mensuel",
        hint:
          doorId === "keep_a"
            ? "Mensualité du prêt déjà en cours"
            : "Mensualité que l'autre continue à payer",
      },
      {
        id: "new-loan",
        label:
          doorId === "keep_a"
            ? "Nouveau prêt pour le rachat"
            : "Nouveau prêt de l'autre pour le rachat",
        amount: newLoan,
        tone: "total",
        sectionId: "mensuel",
        hint: "Montant emprunté pour financer le rachat de parts",
      },
      {
        id: "new-loan-monthly",
        label:
          doorId === "keep_a"
            ? "Mensualité de ce nouveau prêt"
            : "Mensualité du nouveau prêt de l'autre",
        amount: newLoanMonthly,
        tone: "neutral",
        suffix: "/mois",
        sectionId: "mensuel",
        hint: "Mensualité estimée du prêt complémentaire pour le rachat",
      },
      {
        id: "monthly",
        label:
          doorId === "keep_a"
            ? "Total à rembourser chaque mois"
            : "Total mensuel de l'autre après rachat",
        amount: monthly,
        tone: "total",
        suffix: "/mois",
        sectionId: "mensuel",
        hint: "Crédit conservé + nouveau prêt (si la banque accepte)",
      }
    );
  } else {
    lines.push(
      {
        id: "refinance",
        label:
          doorId === "keep_a"
            ? "Nouveau crédit (rachat + dette + frais)"
            : "Nouveau crédit de l'autre (rachat + dette + frais)",
        amount: newLoan,
        tone: "total",
        sectionId: "mensuel",
        hint: "Refinancement total du prêt immobilier",
      },
      {
        id: "monthly",
        label: doorId === "keep_a" ? "Mensualité estimée" : "Mensualité estimée pour l'autre",
        amount: monthly,
        tone: "neutral",
        suffix: "/mois",
        sectionId: "mensuel",
        hint: "Mensualité du nouveau crédit après rachat",
      }
    );
  }

  const pension = childSupportLine(footprint, lab);
  if (pension) lines.push(pension);

  const bankDisclaimer =
    keepExisting && scenario?.bankDisclaimer ? scenario.bankDisclaimer : undefined;
  const { footer, warningNote } = buildKeepFooter({
    doorId,
    negativeEquity,
    verdictDetail: verdict?.detail,
    bankDisclaimer,
  });

  return {
    doorId,
    doorTitle: DOOR_TITLES[doorId],
    verdict,
    lines,
    footer,
    warningNote,
    contextNote: buildKeepContextNote(doorId, verdict, negativeEquity),
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
  const relocateTargetAmount =
    sell?.relocateTarget?.amount ?? estimateRelocateTarget(footprint);
  const capitalGainsTax = sell?.capitalGainsEstimate?.amount ?? 0;

  const lines: LedgerLine[] = [
    {
      id: "property",
      label: "Valeur du bien",
      amount: footprint.propertyValue,
      sectionId: "bien",
      hint: "Prix de vente visé",
    },
    {
      id: "agency",
      label: "Commission d'agence (~5 %)",
      amount: agency,
      tone: "subtract",
      sectionId: "bien",
      hint: "Frais habituels à la charge du vendeur",
    },
    {
      id: "diagnostics",
      label: "Diagnostics obligatoires",
      amount: diagnostics,
      tone: "subtract",
      sectionId: "bien",
      hint: "DPE, amiante, etc.",
    },
    {
      id: "mortgage",
      label: "Prêt immobilier restant",
      amount: footprint.mortgageRemaining,
      tone: "subtract",
      sectionId: "bien",
      hint: "Remboursé sur le prix de vente avant le partage",
    },
  ];

  if (capitalGainsTax > 0) {
    lines.push({
      id: "capital-gains-tax",
      label: "Impôt sur la plus-value (estimation)",
      amount: capitalGainsTax,
      tone: "subtract",
      sectionId: "bien",
      hint: "Prélevé sur le produit de vente si plus-value imposable",
    });
  }

  lines.push(
    {
      id: "net",
      label: negativeEquity ? "Dette nette à partager" : "Argent récolté après tous les frais",
      amount: saleNet,
      tone: "highlight",
      sectionId: "bien",
      hint: negativeEquity
        ? "Le crédit dépasse le produit de vente"
        : "Valeur − agence − diagnostics − crédit ± plus-value",
    },
    {
      id: "you",
      label: negativeEquity ? "Votre part de la dette" : "Votre part nette",
      amount: you,
      tone: "total",
      sectionId: "echange",
      hint: negativeEquity
        ? "Quote-part de la dette restante"
        : "Capital disponible pour vous reloger",
    },
    {
      id: "other",
      label: negativeEquity ? "Part de dette de l'autre" : "Part nette de l'autre",
      amount: other,
      tone: "total",
      sectionId: "echange",
      hint: negativeEquity
        ? "Quote-part de la dette restante"
        : "Capital disponible pour l'autre",
    }
  );

  if (relocateTargetAmount > 0) {
    lines.push({
      id: "relocate-target",
      label: "Prix d'un logement équivalent dans votre quartier",
      amount: relocateTargetAmount,
      tone: "neutral",
      sectionId: "relogement",
      hint: "Repère local pour évaluer le relogement",
    });

    const relocatePaymentYou = relocateMonthlyLine({
      id: "relocate-payment-you",
      label: "Mensualité estimée pour vous reloger (zone)",
      incomeMonthly: footprint.incomeA,
      liquidCapital: you,
      targetPrice: relocateTargetAmount,
      sectionId: "relogement",
    });
    const relocatePaymentOther = relocateMonthlyLine({
      id: "relocate-payment-other",
      label: "Mensualité estimée pour l'autre (zone)",
      incomeMonthly: footprint.incomeB,
      liquidCapital: other,
      targetPrice: relocateTargetAmount,
      sectionId: "relogement",
    });
    if (relocatePaymentYou) lines.push(relocatePaymentYou);
    if (relocatePaymentOther) lines.push(relocatePaymentOther);

    const monthlyYou = relocatePaymentYou?.amount ?? 0;
    if (monthlyYou > 0) {
      lines.push({
        id: "monthly-balance",
        label: "Mensualité estimée pour vous reloger",
        amount: monthlyYou,
        tone: "neutral",
        suffix: "/mois",
        sectionId: "mensuel",
        hint: "Simulation de prêt sur un logement équivalent dans votre quartier",
      });
    }
  }

  const pension = childSupportLine(footprint, lab);
  if (pension) lines.push(pension);

  const relocateVerdict = sell?.relocateVerdictByPerson;
  const footerParts = [
    sell?.capitalGainsNote,
    relocateVerdict
      ? `Relogement dans le quartier — Vous : ${formatAffordabilityVerdictLabel(relocateVerdict.A)} · Autre : ${formatAffordabilityVerdictLabel(relocateVerdict.B)}.`
      : null,
    relocateTargetAmount > 0
      ? `Cible relogement ~${Math.round(relocateTargetAmount).toLocaleString("fr-FR")} € (prix × surface dans votre zone).`
      : null,
    negativeEquity
      ? `Dette résiduelle ~${Math.round(Math.abs(saleNet)).toLocaleString("fr-FR")} € à partager.`
      : `Produit net partagé — Vous : ${Math.round(you).toLocaleString("fr-FR")} € · Autre : ${Math.round(other).toLocaleString("fr-FR")} €.`,
  ].filter(Boolean);

  const contextNote = buildSellContextNote(relocateVerdict, negativeEquity);

  return {
    doorId: "sell",
    doorTitle: DOOR_TITLES.sell,
    verdict,
    lines,
    footer: footerParts.join("\n") || undefined,
    contextNote,
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
  const netEquity = footprint.propertyValue - footprint.mortgageRemaining;
  const relocateTargetAmount = estimateRelocateTarget(footprint);
  const netRounded = Math.round(net);
  const sharedCapital = Math.max(0, netEquity / 2);

  const lines: LedgerLine[] = [
    {
      id: "property",
      label: "Valeur du bien",
      amount: footprint.propertyValue,
      sectionId: "bien",
      hint: "Estimation actuelle du logement conservé en location",
    },
    {
      id: "property-mortgage",
      label: "Prêt immobilier restant",
      amount: footprint.mortgageRemaining,
      tone: "subtract",
      sectionId: "bien",
      hint: "Dette encore due sur le bien loué",
    },
    {
      id: "property-net",
      label: netEquity < 0 ? "Dette nette sur le bien" : "Patrimoine net du logement",
      amount: netEquity,
      tone: "highlight",
      sectionId: "bien",
      hint:
        netEquity < 0
          ? "Le crédit dépasse la valeur du bien"
          : "Valeur du bien moins le crédit restant",
    },
    {
      id: "rent",
      label: "Loyer perçu (estimation)",
      amount: Math.round(bd?.grossRent.amount ?? 0),
      sectionId: "revenus",
      hint: "Basé sur les prix du quartier et la surface",
    },
    {
      id: "vacancy",
      label: `Vacance locative (${Math.round((bd?.vacancyRate ?? 0.06) * 100)} %)`,
      amount: Math.round(bd?.vacancyProvision.amount ?? 0),
      tone: "subtract",
      sectionId: "revenus",
      hint: "Périodes sans locataire",
    },
    {
      id: "effective-rent",
      label: "Loyer réellement encaissé",
      amount: Math.round(bd?.effectiveRent.amount ?? 0),
      tone: "highlight",
      sectionId: "revenus",
      hint: "Loyer perçu après vacance locative",
    },
    {
      id: "mortgage-pay",
      label: lab.enabledLevers.includes("historical_mortgage_rate")
        ? "Mensualité de votre crédit"
        : "Mensualité crédit (taux du marché)",
      amount: Math.round(mortgagePay),
      tone: "subtract",
      sectionId: "charges",
      hint: "Remboursement mensuel du prêt sur le bien loué",
    },
    {
      id: "property-tax",
      label: "Taxe foncière",
      amount: Math.round(bd?.propertyTaxMonthly.amount ?? 0),
      tone: "subtract",
      sectionId: "charges",
      hint: "Montant mensualisé",
    },
    {
      id: "pno",
      label: "Assurance propriétaire (PNO)",
      amount: Math.round(bd?.pnoMonthly.amount ?? 0),
      tone: "subtract",
      sectionId: "charges",
      hint: "Assurance du propriétaire non occupant",
    },
    {
      id: "management",
      label: `Gestion par une agence (${Math.round((bd?.managementFeeRate ?? 0) * 100)} %)`,
      amount: Math.round(bd?.managementFees.amount ?? 0),
      tone: "subtract",
      sectionId: "charges",
      hint: "Honoraires si le bien est géré par une agence",
    },
    {
      id: "tax",
      label: "Impôts sur le loyer",
      amount: Math.round(bd?.incomeTaxEstimate.amount ?? 0),
      tone: "subtract",
      sectionId: "charges",
      hint: "Estimation au régime le plus simple (micro-foncier)",
    },
    {
      id: "net",
      label: "Argent net chaque mois",
      amount: netRounded,
      tone: "total",
      suffix: "/mois",
      sectionId: "resultat",
      hint: "Loyer − charges − impôts",
    },
    {
      id: "monthly-balance",
      label: "Solde mensuel locatif",
      amount: netRounded,
      tone: "total",
      suffix: "/mois",
      sectionId: "mensuel",
      hint: "Ce qu'il reste après crédit, charges et impôts sur le loyer",
    },
    {
      id: "relocate-target",
      label: "Prix d'un logement équivalent dans votre quartier",
      amount: relocateTargetAmount,
      tone: "neutral",
      sectionId: "relogement",
      hint: "Repère local si vous devez vous reloger ailleurs",
    },
  ];

  const relocatePaymentYou = relocateMonthlyLine({
    id: "relocate-payment-you",
    label: "Mensualité estimée pour vous reloger (zone)",
    incomeMonthly: footprint.incomeA,
    liquidCapital: sharedCapital,
    targetPrice: relocateTargetAmount,
    sectionId: "relogement",
  });
  const relocatePaymentOther = relocateMonthlyLine({
    id: "relocate-payment-other",
    label: "Mensualité estimée pour l'autre (zone)",
    incomeMonthly: footprint.incomeB,
    liquidCapital: sharedCapital,
    targetPrice: relocateTargetAmount,
    sectionId: "relogement",
  });
  if (relocatePaymentYou) lines.push(relocatePaymentYou);
  if (relocatePaymentOther) lines.push(relocatePaymentOther);

  if (!lab.enabledLevers.includes("historical_mortgage_rate") && footprint.mortgageRemaining > 0) {
    lines.splice(4, 0, {
      id: "market-ref",
      label: "Référence mensualité marché",
      amount: defaultMortgagePayment(footprint, assumptions),
      tone: "neutral",
      sectionId: "charges",
      hint: "Pour comparer avec votre taux actuel",
    });
  }

  const pension = childSupportLine(footprint, lab);
  if (pension) lines.push(pension);

  const footerParts = [
    scenario?.rentOutFormulaDetail,
    verdict?.headline,
    input.postalCode ? `Zone ${input.postalCode} · ${footprint.propertySurface} m²` : null,
  ].filter(Boolean);

  return {
    doorId: "rent_out",
    doorTitle: DOOR_TITLES.rent_out,
    verdict,
    lines,
    footer: footerParts.join("\n") || undefined,
    contextNote: buildRentContextNote(netRounded),
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
