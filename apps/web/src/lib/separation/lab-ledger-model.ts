import type { AffordabilityVerdict, DoorId, DoorVerdictMap, SimulationResult } from "@separation/schemas";
import {
  estimateChildSupport,
  estimateMonthlyPayment,
  resolveRelocateHousing,
  RENT_GREEN_THRESHOLD,
} from "@separation/engine";
import type { AssumptionsState, FootprintState, LabState } from "./separation-types";
import { compileSimulationInput, defaultAssumptions } from "./compile-simulation-input";
import type { LedgerSectionId } from "./lab-ledger-sections";
import { normalizeKeepFooterDetail } from "./lab-ledger-insights";
import { estimateRelocateTarget, relocateMonthlyLine } from "./lab-ledger-parity";
import { resolveOwnershipPercents } from "./empreinte-context";

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
    return "Le produit de la vente ne suffit pas, pour au moins l'un de vous, à financer un logement solo dans la zone.";
  }
  if (worst === "orange") {
    return "Le relogement solo dans la zone sera serré pour au moins l'un de vous.";
  }
  return "Vos parts nettes permettent, en principe, un relogement solo dans la zone.";
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
  sell: "Vendre pour se reloger",
  sell_rent: "Vendre puis louer",
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

  const contribA =
    lab.enabledLevers.includes("initial_contributions") && lab.overrides.initial_contributions
      ? lab.overrides.initial_contributions.contributionA
      : footprint.contributionA;
  const contribB =
    lab.enabledLevers.includes("initial_contributions") && lab.overrides.initial_contributions
      ? lab.overrides.initial_contributions.contributionB
      : footprint.contributionB;
  if (contribA + contribB > 0) {
    const mode = scenario?.soulte?.contributionMode;
    const label =
      mode === "recompense"
        ? "Apports (récompenses) avant le partage"
        : mode === "creance"
          ? "Apports (créances) avant le partage"
          : `Apports initiaux (vous ${Math.round(contribA).toLocaleString("fr-FR")} € · autre ${Math.round(contribB).toLocaleString("fr-FR")} €)`;
    const hint =
      mode === "recompense"
        ? "Récompenses de communauté (art. 1469) — remboursées avant le partage 50/50"
        : mode === "creance"
          ? "Créances d'apport (art. 815-13) — prélevées avant le partage selon vos parts"
          : "Argent investi au départ — pris en compte avant de partager";
    lines.push({
      id: "contributions",
      label,
      amount: contribA + contribB,
      tone: "neutral",
      sectionId: "bien",
      hint,
    });
  }

  const { shareA: pctA, shareB: pctB } = resolveOwnershipPercents(footprint);
  const otherPct = doorId === "keep_a" ? pctB : pctA;
  const soulteLabel = negativeEquity
    ? "Rachat de parts (impossible — dette nette)"
    : doorId === "keep_a"
      ? `Vous payez à l'autre (sa part ${otherPct} %)`
      : `Vous recevez de l'autre (votre part ${otherPct} %)`;
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
    hint: `Montant pour racheter la part de l'autre (${otherPct} %)`,
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
    const housingNote = scenario?.relocateHousingNote;
    lines.push({
      id: "relocate-target",
      label: housingNote
        ? `Prix cible solo (${housingNote.replace(/^Cible solo ~/, "")})`
        : "Prix cible d'un logement solo dans votre zone",
      amount: relocateTarget,
      tone: "neutral",
      sectionId: "relogement",
      hint: "Hypothèse de relogement après séparation — pas le même bien",
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
  doorId: "sell" | "sell_rent",
  footprint: FootprintState,
  lab: LabState,
  result: SimulationResult,
  verdict: DoorVerdictMap[DoorId] | null
): LabLedgerModel {
  const sell = scenarioFor(result, doorId);
  const asRent = doorId === "sell_rent";
  const { shareA: pctA, shareB: pctB } = resolveOwnershipPercents(footprint);
  const agency = sell?.agencyFeesEstimate?.amount ?? footprint.propertyValue * 0.05;
  const diagnostics = sell?.diagnosticsEstimate?.amount ?? 1800;
  const sellingCosts = sell?.sellingCostsEstimate?.amount ?? agency + diagnostics;
  const saleNet =
    sell?.saleNetProceeds?.amount ??
    footprint.propertyValue - sellingCosts - footprint.mortgageRemaining;
  const you = sell?.saleProceedsByPerson?.A.amount ?? saleNet * (pctA / 100);
  const other = sell?.saleProceedsByPerson?.B.amount ?? saleNet * (pctB / 100);
  const negativeEquity = saleNet < 0 || sell?.negativeEquity === true;
  const housingFallback = resolveRelocateHousing(
    compileSimulationInput({ footprint, assumptions: defaultAssumptions(), lab })
  );
  const relocateTargetAmount =
    sell?.relocateTarget?.amount ?? housingFallback.targetPrice.amount;
  const tenantRent =
    sell?.tenantRentMonthly?.amount ??
    sell?.monthlyPaymentEstimate?.amount ??
    (asRent ? housingFallback.tenantRentMonthly.amount : 0);
  const housingNote = sell?.relocateHousingNote ?? housingFallback.note;
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
      label: negativeEquity
        ? `Votre part de la dette (${pctA} %)`
        : `Votre part nette (${pctA} %)`,
      amount: you,
      tone: "total",
      sectionId: "echange",
      hint: negativeEquity
        ? `Quote-part de la dette restante (${pctA} %)`
        : asRent
          ? `Capital disponible après vente (${pctA} %)`
          : `Capital disponible pour vous reloger (${pctA} %)`,
    },
    {
      id: "other",
      label: negativeEquity
        ? `Part de dette de l'autre (${pctB} %)`
        : `Part nette de l'autre (${pctB} %)`,
      amount: other,
      tone: "total",
      sectionId: "echange",
      hint: negativeEquity
        ? `Quote-part de la dette restante (${pctB} %)`
        : `Capital disponible pour l'autre (${pctB} %)`,
    }
  );

  if (asRent) {
    if (tenantRent > 0) {
      lines.push(
        {
          id: "tenant-rent",
          label: `Loyer cible solo (${housingNote.replace(/^Cible solo ~/, "")})`,
          amount: tenantRent,
          tone: "neutral",
          suffix: "/mois",
          sectionId: "relogement",
          hint: "Hypothèse de location après séparation — pas le même bien",
        },
        {
          id: "monthly-balance",
          label: "Loyer estimé pour vous",
          amount: tenantRent,
          tone: "neutral",
          suffix: "/mois",
          sectionId: "mensuel",
          hint: "Charge locative de référence après vente — sans nouveau crédit immobilier",
        }
      );
    }
  } else if (relocateTargetAmount > 0) {
    lines.push({
      id: "relocate-target",
      label: `Prix cible solo (${housingNote.replace(/^Cible solo ~/, "")})`,
      amount: relocateTargetAmount,
      tone: "neutral",
      sectionId: "relogement",
      hint: "Hypothèse de rachat après vente — pas le même bien",
    });

    const relocatePaymentYou = relocateMonthlyLine({
      id: "relocate-payment-you",
      label: "Mensualité estimée pour vous reloger (solo)",
      incomeMonthly: footprint.incomeA,
      liquidCapital: you,
      targetPrice: relocateTargetAmount,
      sectionId: "relogement",
    });
    const relocatePaymentOther = relocateMonthlyLine({
      id: "relocate-payment-other",
      label: "Mensualité estimée pour l'autre (solo)",
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
        hint: "Simulation de prêt pour un logement solo dans votre zone",
      });
    }
  }

  const pension = childSupportLine(footprint, lab);
  if (pension) lines.push(pension);

  const relocateVerdict = sell?.relocateVerdictByPerson;
  const footerParts = [
    sell?.capitalGainsNote,
    housingNote,
    relocateVerdict
      ? asRent
        ? `Location solo — Vous : ${formatAffordabilityVerdictLabel(relocateVerdict.A)} · Autre : ${formatAffordabilityVerdictLabel(relocateVerdict.B)}.`
        : `Relogement solo (rachat) — Vous : ${formatAffordabilityVerdictLabel(relocateVerdict.A)} · Autre : ${formatAffordabilityVerdictLabel(relocateVerdict.B)}.`
      : null,
    asRent && tenantRent > 0
      ? `Loyer cible ~${Math.round(tenantRent).toLocaleString("fr-FR")} €/mois.`
      : !asRent && relocateTargetAmount > 0
        ? `Cible rachat ~${Math.round(relocateTargetAmount).toLocaleString("fr-FR")} €.`
        : null,
    negativeEquity
      ? `Dette résiduelle ~${Math.round(Math.abs(saleNet)).toLocaleString("fr-FR")} € à partager.`
      : `Produit net partagé — Vous : ${Math.round(you).toLocaleString("fr-FR")} € · Autre : ${Math.round(other).toLocaleString("fr-FR")} €.`,
  ].filter(Boolean);

  const contextNote = asRent
    ? negativeEquity
      ? "Actif net négatif — dette à partager avant toute location."
      : relocateVerdict
        ? `Après vente, location zone — Vous : ${formatAffordabilityVerdictLabel(relocateVerdict.A)} · Autre : ${formatAffordabilityVerdictLabel(relocateVerdict.B)}.`
        : "Vente puis location dans la zone — capital et effort locatif."
    : buildSellContextNote(relocateVerdict, negativeEquity);

  return {
    doorId,
    doorTitle: DOOR_TITLES[doorId],
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
  const relocateTargetAmount = estimateRelocateTarget(footprint, lab);
  const netRounded = Math.round(net);
  const { shareA: pctA, shareB: pctB } = resolveOwnershipPercents(footprint);
  const capitalA = Math.max(0, netEquity * (pctA / 100));
  const capitalB = Math.max(0, netEquity * (pctB / 100));
  const hasEmpreinteMortgage = footprint.monthlyMortgagePayment > 0;

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
      label:
        lab.enabledLevers.includes("historical_mortgage_rate") || hasEmpreinteMortgage
          ? "Mensualité de votre crédit"
          : "Mensualité crédit (taux du marché)",
      amount: Math.round(mortgagePay),
      tone: "subtract",
      sectionId: "charges",
      hint: hasEmpreinteMortgage
        ? "Mensualité issue de votre Empreinte"
        : "Remboursement mensuel du prêt sur le bien loué",
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
      label: "Prix cible d'un logement solo dans votre zone",
      amount: relocateTargetAmount,
      tone: "neutral",
      sectionId: "relogement",
      hint: "Hypothèse si vous devez vous reloger ailleurs — pas le même bien",
    },
  ];

  const relocatePaymentYou = relocateMonthlyLine({
    id: "relocate-payment-you",
    label: `Mensualité estimée pour vous reloger (zone · ${pctA} %)`,
    incomeMonthly: footprint.incomeA,
    liquidCapital: capitalA,
    targetPrice: relocateTargetAmount,
    sectionId: "relogement",
  });
  const relocatePaymentOther = relocateMonthlyLine({
    id: "relocate-payment-other",
    label: `Mensualité estimée pour l'autre (zone · ${pctB} %)`,
    incomeMonthly: footprint.incomeB,
    liquidCapital: capitalB,
    targetPrice: relocateTargetAmount,
    sectionId: "relogement",
  });
  if (relocatePaymentYou) lines.push(relocatePaymentYou);
  if (relocatePaymentOther) lines.push(relocatePaymentOther);

  // Référence marché uniquement si on n'a pas déjà la mensualité Empreinte / levier.
  if (
    !lab.enabledLevers.includes("historical_mortgage_rate") &&
    !hasEmpreinteMortgage &&
    footprint.mortgageRemaining > 0
  ) {
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
    case "sell_rent":
      return buildSellLedger(doorId, footprint, lab, result, verdict);
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
