import type {
  AffordabilityVerdict,
  DoorId,
  DoorVerdictMap,
  ScenarioComparison,
  SimulationResult,
} from "@separation/schemas";
import { formatEuro } from "@/lib/utils";
import { formatAffordabilityVerdictLabel } from "./lab-ledger-model";
import {
  formatVerdictLabel,
  normalizeKeepFooterDetail,
  stripBankDisclaimer,
} from "./lab-ledger-insights";

const MATRIX_TITLES: Record<DoorId, string> = {
  keep_a: "Garder le bien",
  keep_b: "L'autre garde le bien",
  sell: "Vendre pour se reloger",
  sell_rent: "Vendre puis louer",
  rent_out: "Garder et louer",
};

export interface ExportNarrativeBlock {
  title: string;
  body: string;
}

export interface ExportDoorVerdictSummary {
  level: AffordabilityVerdict;
  label: string;
  headline: string;
  detail: string;
}

export interface ExportMatrixRow {
  doorId: DoorId;
  title: string;
  verdictLabel: string;
  verdictLevel: AffordabilityVerdict;
  cashLabel: string;
  monthlyLabel: string;
  relocateLabel: string;
}

function scenarioFor(
  result: SimulationResult | null,
  doorId: DoorId
): ScenarioComparison | undefined {
  return result?.scenarios.find((s) => s.scenario === doorId);
}

function relocateLabel(v: AffordabilityVerdict | undefined): string {
  if (!v) return "—";
  return formatAffordabilityVerdictLabel(v);
}

function bilateralRelocate(
  scenario: ScenarioComparison | undefined
): string {
  const map = scenario?.relocateVerdictByPerson;
  if (!map) {
    if (scenario?.departureRelocateVerdict) {
      return `Partant : ${relocateLabel(scenario.departureRelocateVerdict)}`;
    }
    return "—";
  }
  return `Vous : ${relocateLabel(map.A)} · Autre : ${relocateLabel(map.B)}`;
}

/** Ligne de la matrice comparative (1 par porte). */
export function buildMatrixRow(
  doorId: DoorId,
  result: SimulationResult | null,
  verdicts: DoorVerdictMap | null
): ExportMatrixRow {
  const scenario = scenarioFor(result, doorId);
  const verdict = verdicts?.[doorId];
  const level = verdict?.verdict ?? "orange";

  let cashLabel = "—";
  let monthlyLabel = "—";
  let relocate = "—";

  if (doorId === "keep_a" || doorId === "keep_b") {
    const soulte = scenario?.soulte?.amount.amount;
    const cash = scenario?.soulte?.totalCashNeeded?.amount ?? soulte;
    const departure = scenario?.departureCapital?.amount;
    cashLabel =
      cash != null
        ? doorId === "keep_a"
          ? `Rachat ~ ${formatEuro(cash)}`
          : `Capital ~ ${formatEuro(departure ?? soulte ?? 0)}`
        : "—";
    const monthly = scenario?.monthlyPaymentEstimate?.amount ?? verdict?.monthlyImpact?.amount;
    monthlyLabel = monthly != null ? `${formatEuro(monthly)} / mois` : "—";
    relocate = scenario?.departureRelocateVerdict
      ? `Partant : ${relocateLabel(scenario.departureRelocateVerdict)}`
      : "—";
  } else if (doorId === "sell" || doorId === "sell_rent") {
    const you = scenario?.saleProceedsByPerson?.A.amount;
    cashLabel = you != null ? `Votre part ~ ${formatEuro(you)}` : "—";
    if (doorId === "sell_rent") {
      const rent = scenario?.tenantRentMonthly?.amount;
      monthlyLabel = rent != null ? `Loyer ~ ${formatEuro(rent)} / mois` : "—";
    } else {
      monthlyLabel = "Mensualité solo (zone)";
    }
    relocate = bilateralRelocate(scenario);
  } else if (doorId === "rent_out") {
    const net = scenario?.rentOutBreakdown?.netCashflow.amount;
    const equity =
      (scenario?.netWorthByPerson?.A.amount ?? 0) +
      (scenario?.netWorthByPerson?.B.amount ?? 0);
    cashLabel = equity > 0 ? `Actif net ~ ${formatEuro(equity)}` : "Bien conservé";
    monthlyLabel = net != null ? `Cashflow ${formatEuro(net)} / mois` : "—";
    relocate = bilateralRelocate(scenario);
  }

  return {
    doorId,
    title: MATRIX_TITLES[doorId],
    verdictLabel: verdict ? formatVerdictLabel(verdict.verdict) : "—",
    verdictLevel: level,
    cashLabel,
    monthlyLabel,
    relocateLabel: relocate,
  };
}

function keepHowItWorks(
  doorId: "keep_a" | "keep_b",
  scenario: ScenarioComparison | undefined
): ExportNarrativeBlock[] {
  const youKeep = doorId === "keep_a";
  const soulte = scenario?.soulte?.amount.amount;
  const totalCash = scenario?.soulte?.totalCashNeeded?.amount;
  const departure = scenario?.departureCapital?.amount;
  const mode = scenario?.soulte?.contributionMode;

  const blocks: ExportNarrativeBlock[] = [
    {
      title: "En clair",
      body: youKeep
        ? "Vous gardez le logement. Pour ça, vous rachetez la part de l'autre — comme si vous lui rachetiez sa part de maison. Il faudra aussi régler les frais de notaire et, en général, que la banque accepte de laisser le crédit (ou un nouveau crédit) à votre seul nom."
        : "L'autre garde le logement et vous rachète votre part. Vous sortez du bien avec une somme d'argent, et vous n'êtes plus lié·e au crédit — sous réserve que la banque valide ce montage.",
    },
    {
      title: "L'argent qui change de mains",
      body:
        soulte != null
          ? `On estime la somme due pour la part (la « soulte ») à ${formatEuro(soulte)}` +
            (totalCash != null && totalCash !== soulte
              ? `. Avec les frais d'acte, il faut plutôt compter ~${formatEuro(totalCash)} au total.`
              : ".") +
            (departure != null
              ? ` De l'autre côté, la personne qui part repart avec environ ${formatEuro(departure)} en poche.`
              : "")
          : "Le montant exact dépend de la valeur du bien, du crédit restant, de vos parts et des apports que chacun a mis au départ.",
    },
  ];

  if (mode === "creance") {
    blocks.push({
      title: "Et vos apports ?",
      body:
        "Vous n'étiez pas mariés sous le régime de communauté (ou équivalent). Les sommes mises en plus au départ sont remboursées en priorité avant le partage — comme une dette entre vous (créance d'indivision, art. 815-13). Vos parts sur l'acte ne changent pas pour autant.",
    });
  } else if (mode === "recompense") {
    blocks.push({
      title: "Et vos apports ?",
      body:
        "En mariage (ou régime équivalent), les apports personnels peuvent ouvrir droit à une « récompense » (art. 1469) : on tient compte de ce que l'argent a réellement apporté au bien, surtout si on connaît le prix d'achat.",
    });
  } else {
    blocks.push({
      title: "Et vos apports ?",
      body:
        "Pour l'instant, on partage surtout selon les parts écrites sur l'acte. Si vous activez les apports dans le laboratoire, le calcul peut alors tenir compte de qui a mis plus d'argent au départ.",
    });
  }

  const monthly = scenario?.monthlyPaymentEstimate?.amount;
  const relocateWord = scenario?.departureRelocateVerdict
    ? formatAffordabilityVerdictLabel(scenario.departureRelocateVerdict).toLowerCase()
    : null;
  blocks.push({
    title: "Au quotidien, après",
    body:
      monthly != null
        ? `Celle ou celui qui reste paie environ ${formatEuro(monthly)} par mois de crédit (selon ce que la banque accepte). ` +
          (youKeep
            ? `L'autre devra se reloger seul·e dans la zone` +
              (relocateWord ? ` — pour l'instant, ça paraît ${relocateWord}` : "") +
              `.`
            : `Vous, de votre côté, devrez vous reloger` +
              (relocateWord ? ` — pour l'instant, ça paraît ${relocateWord}` : "") +
              `.`)
        : "Celle ou celui qui garde le bien porte le crédit. L'autre utilise l'argent reçu pour se loger ailleurs.",
  });

  return blocks;
}

function sellHowItWorks(scenario: ScenarioComparison | undefined): ExportNarrativeBlock[] {
  const net = scenario?.saleNetProceeds?.amount;
  const you = scenario?.saleProceedsByPerson?.A.amount;
  const other = scenario?.saleProceedsByPerson?.B.amount;
  return [
    {
      title: "En clair",
      body:
        "Vous vendez le bien ensemble. Sur le prix de vente, on enlève l'agence (souvent ~5 %), les diagnostics, le remboursement du crédit, et parfois un impôt sur la plus-value. Ce qui reste se partage selon vos parts.",
    },
    {
      title: "Ce que chacun récupère",
      body:
        net != null
          ? `Après toutes ces déductions, il resterait environ ${formatEuro(net)} à se partager` +
            (you != null && other != null
              ? ` : ~${formatEuro(you)} pour vous, ~${formatEuro(other)} pour l'autre.`
              : ".")
          : "Chaque part nette devient l'argent disponible pour un prochain logement.",
    },
    {
      title: "Et après la vente ?",
      body:
        "Chacun peut ensuite racheter seul un logement dans la zone, avec sa part comme apport. " +
        (scenario?.relocateHousingNote ? `${scenario.relocateHousingNote}. ` : "") +
        (bilateralRelocate(scenario) !== "—"
          ? `Pour se reloger : ${bilateralRelocate(scenario)}.`
          : "On regarde si c'est tenable selon vos revenus et les prix du quartier."),
    },
  ];
}

function sellRentHowItWorks(scenario: ScenarioComparison | undefined): ExportNarrativeBlock[] {
  const rent = scenario?.tenantRentMonthly?.amount;
  return [
    {
      title: "En clair",
      body:
        "Même idée que « vendre pour se reloger », sauf qu'après la vente vous louez plutôt que d'acheter. C'est souvent plus simple si l'apport ne suffit pas pour un crédit solo, ou si vous voulez garder de la souplesse.",
    },
    {
      title: "Ce que chacun récupère",
      body:
        scenario?.saleProceedsByPerson
          ? `Après la vente : environ ${formatEuro(scenario.saleProceedsByPerson.A.amount)} pour vous et ${formatEuro(scenario.saleProceedsByPerson.B.amount)} pour l'autre. Cet argent reste disponible — épargne, dépôt de garantie, projet plus tard.`
          : "La vente libère de l'argent pour chacun. Ensuite, le logement suivant, c'est un loyer — pas un nouveau crédit.",
    },
    {
      title: "Le loyer à viser",
      body:
        rent != null
          ? `On estime un loyer solo autour de ${formatEuro(rent)} par mois` +
            (scenario?.relocateHousingNote ? ` (${scenario.relocateHousingNote})` : "") +
            `. C'est calé sur les loyers de votre zone (données publiques), pas sur une annonce au hasard.`
          : "Le loyer cible suit les prix de votre zone et la taille de logement que vous visez en solo.",
    },
  ];
}

function rentOutHowItWorks(scenario: ScenarioComparison | undefined): ExportNarrativeBlock[] {
  const bd = scenario?.rentOutBreakdown;
  return [
    {
      title: "En clair",
      body:
        "Vous gardez le bien à deux et vous le louez. Le loyer doit d'abord payer le crédit, la taxe foncière, l'assurance, la gestion, les mois sans locataire… et les impôts. Ce qui reste, s'il en reste, se partage.",
    },
    {
      title: "Ce qui reste chaque mois",
      body: bd
        ? `Sur un loyer d'environ ${formatEuro(bd.grossRent.amount)} (plutôt ${formatEuro(bd.effectiveRent.amount)} une fois les mois vides prévus), ` +
          `il faudrait encore sortir ~${formatEuro(bd.incomeTaxEstimate.amount)} d'impôts et charges fiscales. ` +
          `Au final, il resterait environ ${formatEuro(bd.netCashflow.amount)} par mois — à se partager ou à mettre de côté.`
        : "Le résultat mensuel dépend surtout du loyer possible dans votre zone, du crédit qui reste, et des impôts.",
    },
    {
      title: "À avoir en tête",
      body:
        "Ça marche seulement si vous vous mettez d'accord sur la gestion, les travaux et la façon de sortir plus tard. " +
        "Et attention : le loyer encaissé ne remplace pas un apport pour vous loger ailleurs — chacun doit aussi pouvoir se reloger.",
    },
  ];
}

/** Blocs « Comment ça marche » — textes experts, montants dynamiques. */
export function buildDoorHowItWorks(
  doorId: DoorId,
  result: SimulationResult | null
): ExportNarrativeBlock[] {
  const scenario = scenarioFor(result, doorId);
  if (doorId === "keep_a" || doorId === "keep_b") return keepHowItWorks(doorId, scenario);
  if (doorId === "sell") return sellHowItWorks(scenario);
  if (doorId === "sell_rent") return sellRentHowItWorks(scenario);
  return rentOutHowItWorks(scenario);
}

/** Prochaines étapes concrètes par porte. */
export function buildDoorNextSteps(
  doorId: DoorId,
  result: SimulationResult | null,
  verdicts: DoorVerdictMap | null
): string[] {
  const scenario = scenarioFor(result, doorId);
  const verdict = verdicts?.[doorId]?.verdict;
  const steps: string[] = [];

  if (doorId === "keep_a" || doorId === "keep_b") {
    steps.push(
      "Montrez ces chiffres à un notaire : il pourra confirmer ce que coûtera vraiment l'acte (rachat + frais)."
    );
    steps.push(
      doorId === "keep_a"
        ? "Prenez rendez-vous à la banque pour savoir si elle accepte de vous laisser le crédit (ou un nouveau prêt) à votre seul nom."
        : "Demandez à l'autre de vérifier auprès de sa banque avant de figer le montant — sans accord, le projet peut bloquer."
    );
    if (verdict === "red" || verdict === "orange") {
      steps.push(
        "Si le rachat paraît trop serré, regardez aussi la vente : parfois c'est plus simple pour les deux."
      );
    } else {
      steps.push(
        "Mettez-vous d'accord sur qui reste dans le logement jusqu'à la signature, et si une indemnité est due entre-temps."
      );
    }
  } else if (doorId === "sell") {
    steps.push(
      "Faites estimer le bien par un ou deux pros du quartier, puis fixez un prix de mise en vente réaliste."
    );
    steps.push(
      "Gardez en tête agence, diagnostics et éventuelle plus-value — pour ne pas surestimer l'argent disponible après."
    );
    steps.push(
      "Avant de signer un prix trop bas, simulez un prêt solo avec votre part comme apport."
    );
  } else if (doorId === "sell_rent") {
    steps.push(
      "Vérifiez que le loyer visé reste tenable avec vos seuls revenus — sans compter sur ceux de l'autre."
    );
    steps.push(
      "Gardez une réserve après la vente : dépôt de garantie, déménagement, et idéalement 2–3 mois de loyer."
    );
    if ((scenario?.tenantRentMonthly?.amount ?? 0) > 0) {
      steps.push(
        "Comparez quelques vraies annonces dans votre code postal pour voir si notre estimation tient la route."
      );
    }
  } else {
    steps.push(
      "Écrivez noir sur blanc qui gère quoi : baux, travaux, et comment l'un pourra sortir plus tard."
    );
    steps.push(
      "Si les charges sont lourdes, faites vérifier les impôts locatifs avec un comptable (il existe plusieurs façons de déclarer)."
    );
    const net = scenario?.rentOutBreakdown?.netCashflow.amount ?? 0;
    if (net < 0) {
      steps.push(
        "Ici le mois est négatif : calculez combien chacun devra remettre chaque mois avant de vous engager."
      );
    } else {
      steps.push(
        "Prévoyez aussi où chacun habitera : le loyer encaissé ne paie pas automatiquement un nouvel achat."
      );
    }
  }

  return steps.slice(0, 3);
}

export function buildDoorVerdictSummary(
  doorId: DoorId,
  verdicts: DoorVerdictMap | null
): ExportDoorVerdictSummary | null {
  const verdict = verdicts?.[doorId];
  if (!verdict) return null;
  const detail =
    doorId === "keep_a" || doorId === "keep_b"
      ? normalizeKeepFooterDetail(stripBankDisclaimer(verdict.detail), doorId)
      : verdict.detail;
  return {
    level: verdict.verdict,
    label: formatVerdictLabel(verdict.verdict),
    headline: verdict.headline,
    detail,
  };
}
