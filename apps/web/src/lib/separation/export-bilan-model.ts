import type { DoorId, ScenarioComparison } from "@separation/schemas";
import { formatEuro } from "@/lib/utils";
import type { AssumptionsState, FootprintState, LabState } from "./separation-types";
import { buildLabLedger, defaultMortgagePayment, formatAffordabilityVerdictLabel, type LabLedgerModel } from "./lab-ledger-model";
import {
  formatVerdictLabel,
  normalizeKeepFooterDetail,
  stripBankDisclaimer,
} from "./lab-ledger-insights";
import type { DoorVerdictMap, SimulationResult } from "@separation/schemas";
import { DOOR_ORDER } from "./porte-presenter";
import {
  buildDoorHowItWorks,
  buildDoorNextSteps,
  buildDoorVerdictSummary,
  buildMatrixRow,
  type ExportDoorVerdictSummary,
  type ExportMatrixRow,
  type ExportNarrativeBlock,
} from "./export-door-narrative";

export interface ExportField {
  label: string;
  value: string;
}

export interface ExportLeverLine {
  id: string;
  label: string;
  value: string;
}

export interface ExportInsight {
  title: string;
  body: string;
}

export interface ExportBilanModel {
  scenarioTitle: string;
  dateLabel: string;
  footprint: ExportField[];
  activeLevers: ExportLeverLine[];
  insights: ExportInsight[];
  ledger: LabLedgerModel;
  disclaimer: string;
}

export interface ExportDoorChapter {
  doorId: DoorId;
  title: string;
  verdict: ExportDoorVerdictSummary | null;
  howItWorks: ExportNarrativeBlock[];
  nextSteps: string[];
  bilan: ExportBilanModel;
}

export interface ExpertExportPack {
  dateLabel: string;
  proofId?: string;
  email?: string;
  coverSubtitle: string;
  footprint: ExportField[];
  activeLevers: ExportLeverLine[];
  matrix: ExportMatrixRow[];
  chapters: ExportDoorChapter[];
  activeDoorId: DoorId | null;
  disclaimer: string;
}

export const EXPORT_DISCLAIMER =
  "Document Clarté (pack 2026.6). Ce sont des ordres de grandeur pour discuter, pas un acte. En résumé : au rachat, comptez le droit de partage (CGI 746) et environ 1,5 % de frais de notaire ; les apports peuvent se traiter en créance (815-13) ou récompense (1469). À la vente : agence (~5 %), diagnostics, éventuelle plus-value. En location : mois vides, charges et impôts. Garder le crédit actuel suppose l’accord de la banque. Parlez-en à un notaire avant de décider.";

export const EXPORT_SCENARIO_TITLES: Record<DoorId, string> = {
  keep_a: "Projet : garder le bien",
  keep_b: "Projet : l'autre garde le bien",
  sell: "Projet : vendre pour se reloger",
  sell_rent: "Projet : vendre puis louer",
  rent_out: "Projet : garder et louer",
};

export function formatExportDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function buildActiveLeverLines(
  lab: LabState,
  footprint: FootprintState,
  assumptions: AssumptionsState
): ExportLeverLine[] {
  const lines: ExportLeverLine[] = [];

  if (lab.enabledLevers.includes("initial_contributions")) {
    const cfg = lab.overrides.initial_contributions ?? { contributionA: 0, contributionB: 0 };
    lines.push({
      id: "initial_contributions",
      label: "Apports initiaux",
      value: `${formatEuro(cfg.contributionA)} / ${formatEuro(cfg.contributionB)}`,
    });
  }

  if (lab.enabledLevers.includes("historical_mortgage_rate")) {
    const monthly =
      lab.overrides.historical_mortgage_rate?.monthlyMortgagePayment ??
      defaultMortgagePayment(footprint, assumptions);
    lines.push({
      id: "historical_mortgage_rate",
      label: "Mensualité actuelle du crédit",
      value: `${formatEuro(monthly)}/mois`,
    });
  }

  if (lab.enabledLevers.includes("children_impact")) {
    const cfg = lab.overrides.children_impact;
    if (cfg?.hasMinorChildren && cfg.numberOfChildren > 0) {
      const custody = cfg.custodyType === "alternate" ? "alternée" : "classique";
      lines.push({
        id: "children_impact",
        label: "Impact enfants",
        value: `${cfg.numberOfChildren} enfant${cfg.numberOfChildren > 1 ? "s" : ""}, garde ${custody}`,
      });
    } else {
      lines.push({
        id: "children_impact",
        label: "Impact enfants",
        value: "Aucun enfant mineur à charge",
      });
    }
  }

  if (lab.enabledLevers.includes("occupation_indemnity")) {
    const months = lab.overrides.occupation_indemnity?.occupationMonths ?? 0;
    lines.push({
      id: "occupation_indemnity",
      label: "Occupation exclusive avant signature",
      value: months > 0 ? `${months} mois` : "Activé",
    });
  }

  if (lab.enabledLevers.includes("relocate_housing")) {
    const cfg = lab.overrides.relocate_housing;
    const tierLabel =
      cfg?.marketTier === "median"
        ? "médian"
        : cfg?.marketTier === "high"
          ? "haut de zone"
          : "entrée de zone";
    const sqm = cfg?.surfaceSqm;
    lines.push({
      id: "relocate_housing",
      label: "Relogement solo",
      value:
        sqm != null && sqm > 0
          ? `${Math.round(sqm)} m² · gamme ${tierLabel}`
          : `Gamme ${tierLabel}`,
    });
  }

  return lines;
}

function scenarioFor(result: SimulationResult, doorId: DoorId): ScenarioComparison | undefined {
  return result.scenarios.find((s) => s.scenario === doorId);
}

export function buildExportInsights(
  doorId: DoorId,
  result: SimulationResult | null,
  verdicts: DoorVerdictMap | null
): ExportInsight[] {
  if (!result) return [];
  const scenario = scenarioFor(result, doorId);
  const verdict = verdicts?.[doorId];
  const insights: ExportInsight[] = [];

  if (verdict) {
    const detail =
      doorId === "keep_a" || doorId === "keep_b"
        ? normalizeKeepFooterDetail(stripBankDisclaimer(verdict.detail), doorId)
        : verdict.detail;
    const fullDetail = detail.replace(/\n+/g, " ").trim();
    insights.push({
      title: `En une phrase — ${formatVerdictLabel(verdict.verdict).toLowerCase()}`,
      body: `${verdict.headline}. ${fullDetail}`,
    });
  }

  if (doorId === "keep_a" || doorId === "keep_b") {
    const departure = scenario?.departureCapital?.amount ?? scenario?.soulte?.amount.amount;
    const relocate = scenario?.departureRelocateVerdict;
    const indemnity = scenario?.occupationIndemnity?.amount ?? 0;
    if (departure != null) {
      insights.push({
        title: "Pour la personne qui part",
        body: `Elle repartirait avec environ ${formatEuro(departure)}${
          indemnity > 0
            ? ` (dont ${formatEuro(indemnity)} d'indemnité si l'autre occupe le bien entre-temps)`
            : ""
        }. Se reloger seul·e dans la zone paraît ${
          relocate ? formatAffordabilityVerdictLabel(relocate).toLowerCase() : "encore à évaluer"
        }${
          scenario?.relocateHousingNote ? ` — ${scenario.relocateHousingNote}` : ""
        }${
          scenario?.relocateTarget
            ? ` (autour de ${formatEuro(scenario.relocateTarget.amount)})`
            : ""
        }.`,
      });
    }
    if (scenario?.occupationNote) {
      insights.push({
        title: "Si l'un reste dans le logement",
        body: scenario.occupationNote,
      });
    }
  }

  if (doorId === "rent_out" && scenario?.rentOutBreakdown) {
    const bd = scenario.rentOutBreakdown;
    insights.push({
      title: "D'où vient le résultat mensuel ?",
      body:
        `Loyer ~${formatEuro(bd.grossRent.amount)}, dont on met de côté ~${formatEuro(bd.vacancyProvision.amount)} pour les mois sans locataire ` +
        `(il reste ~${formatEuro(bd.effectiveRent.amount)} « utiles »). ` +
        `Puis crédit (${formatEuro(bd.mortgagePayment.amount)}), taxe foncière, assurance, gestion, et ~${formatEuro(bd.incomeTaxEstimate.amount)} d'impôts. ` +
        `Au bout du compte : ${formatEuro(bd.netCashflow.amount)} / mois.`,
    });
    if (scenario.rentOutFormulaDetail) {
      insights.push({
        title: "Le calcul en une ligne",
        body: scenario.rentOutFormulaDetail,
      });
    }
  }

  if (doorId === "sell" || doorId === "sell_rent") {
    if (scenario?.capitalGainsNote) {
      insights.push({ title: "Et la plus-value ?", body: scenario.capitalGainsNote });
    }
    if ((scenario?.capitalGainsEstimate?.amount ?? 0) > 0) {
      insights.push({
        title: "Impôt estimé sur la plus-value",
        body: `Environ ${formatEuro(scenario!.capitalGainsEstimate!.amount)} seraient retenus sur le net vendeur (impôt + prélèvements sociaux).`,
      });
    }
    if (scenario?.saleProceedsByPerson) {
      insights.push({
        title: "Après la vente, qui a quoi ?",
        body: `Vous ~${formatEuro(scenario.saleProceedsByPerson.A.amount)} · l'autre ~${formatEuro(scenario.saleProceedsByPerson.B.amount)} (une fois agence, diagnostics, crédit et plus-value éventuelle déduits).`,
      });
    }
    if (doorId === "sell_rent" && (scenario?.tenantRentMonthly?.amount ?? 0) > 0) {
      insights.push({
        title: "Le loyer qu'on vise après",
        body: `${scenario?.relocateHousingNote ?? "Logement solo"} — autour de ${formatEuro(scenario!.tenantRentMonthly!.amount)} / mois.`,
      });
    } else if (doorId === "sell" && scenario?.relocateHousingNote) {
      insights.push({
        title: "Pour se reloger ensuite",
        body: `${scenario.relocateHousingNote}${
          scenario.relocateTarget
            ? ` — on vise plutôt un bien autour de ${formatEuro(scenario.relocateTarget.amount)}`
            : ""
        }.`,
      });
    }
  }

  if (result.compensatoryAllowance?.applicable) {
    insights.push({
      title: "Prestation compensatoire (si mariage)",
      body: result.compensatoryAllowance.note,
    });
  }

  if (doorId === "keep_a" || doorId === "keep_b") {
    const mode = scenario?.soulte?.contributionMode;
    if (mode === "creance") {
      insights.push({
        title: "Apports remboursés en priorité",
        body: `On traite les apports comme des sommes à rembourser avant le partage (art. 815-13) : environ ${formatEuro(scenario?.soulte?.creanceA?.amount ?? 0)} pour vous et ${formatEuro(scenario?.soulte?.creanceB?.amount ?? 0)} pour l'autre. Vos parts sur l'acte restent les mêmes.`,
      });
    }
    if (mode === "recompense") {
      insights.push({
        title: "Apports et récompenses",
        body: `On estime des récompenses (art. 1469) d'environ ${formatEuro(scenario?.soulte?.recompenseA?.amount ?? 0)} pour vous et ${formatEuro(scenario?.soulte?.recompenseB?.amount ?? 0)} pour l'autre — surtout utile si le prix d'achat est connu.`,
      });
    }
  }

  return insights;
}

export function buildFootprintExportFields(
  footprint: FootprintState,
  assumptions: AssumptionsState
): ExportField[] {
  if (!footprint || !assumptions) return [];
  return [
    { label: "Code postal", value: footprint.postalCode },
    { label: "Valeur du bien", value: formatEuro(footprint.propertyValue) },
    {
      label: "Crédit restant",
      value:
        footprint.financementDeclared && footprint.mortgageRemaining === 0
          ? "Sans crédit"
          : formatEuro(footprint.mortgageRemaining),
    },
    {
      label: "Statut du couple",
      value:
        footprint.legalStatus === "marriage"
          ? "Mariés"
          : footprint.legalStatus === "pacs"
            ? "PACS"
            : footprint.legalStatus === "concubinage"
              ? "Union libre"
              : "—",
    },
    {
      label: "Répartition de la propriété",
      value: `Vous ${footprint.ownershipShareA || 50} % · Autre ${footprint.ownershipShareB || 50} %`,
    },
    ...(footprint.contributionA > 0 || footprint.contributionB > 0
      ? [
          {
            label: "Apports à l'achat",
            value: `Vous ${formatEuro(footprint.contributionA)} · Autre ${formatEuro(footprint.contributionB)}`,
          },
        ]
      : []),
    { label: "Vos revenus nets", value: `${formatEuro(footprint.incomeA)}/mois` },
    { label: "Revenus de l'autre partie", value: `${formatEuro(footprint.incomeB)}/mois` },
    {
      label: "Surface retenue",
      value: `${footprint.propertySurface || assumptions.propertySurface || 65} m²`,
    },
  ];
}

export function buildExportBilan(params: {
  doorId: DoorId;
  footprint: FootprintState;
  assumptions: AssumptionsState;
  lab: LabState;
  result: SimulationResult | null;
  doorVerdicts: DoorVerdictMap | null;
  date?: Date;
}): ExportBilanModel | null {
  const { doorId, footprint, assumptions, lab, result, doorVerdicts, date } = params;
  const ledger = buildLabLedger({
    doorId,
    footprint,
    assumptions,
    lab,
    result,
    doorVerdicts,
  });
  if (!ledger) return null;

  return {
    scenarioTitle: EXPORT_SCENARIO_TITLES[doorId],
    dateLabel: formatExportDate(date),
    footprint: buildFootprintExportFields(footprint, assumptions),
    activeLevers: buildActiveLeverLines(lab, footprint, assumptions),
    insights: buildExportInsights(doorId, result, doorVerdicts),
    ledger,
    disclaimer: EXPORT_DISCLAIMER,
  };
}

function orderDoors(activeDoorId: DoorId | null): DoorId[] {
  if (!activeDoorId) return [...DOOR_ORDER];
  return [activeDoorId, ...DOOR_ORDER.filter((id) => id !== activeDoorId)];
}

/** Pack multi-portes pour le PDF expert et l'écran Export. */
export function buildExpertExportPack(params: {
  footprint: FootprintState;
  assumptions: AssumptionsState;
  lab: LabState;
  result: SimulationResult | null;
  doorVerdicts: DoorVerdictMap | null;
  date?: Date;
  proofId?: string;
  email?: string;
}): ExpertExportPack | null {
  const { footprint, assumptions, lab, result, doorVerdicts, date, proofId, email } = params;
  if (!footprint || !assumptions || !lab) return null;
  const dateLabel = formatExportDate(date);
  const footprintFields = buildFootprintExportFields(footprint, assumptions);
  const activeLevers = buildActiveLeverLines(lab, footprint, assumptions);
  const activeDoorId = lab.activeDoor;

  const chapters: ExportDoorChapter[] = [];
  for (const doorId of orderDoors(activeDoorId)) {
    const bilan = buildExportBilan({
      doorId,
      footprint,
      assumptions,
      lab: { ...lab, activeDoor: doorId },
      result,
      doorVerdicts,
      date,
    });
    if (!bilan) continue;
    chapters.push({
      doorId,
      title: EXPORT_SCENARIO_TITLES[doorId],
      verdict: buildDoorVerdictSummary(doorId, doorVerdicts),
      howItWorks: buildDoorHowItWorks(doorId, result),
      nextSteps: buildDoorNextSteps(doorId, result, doorVerdicts),
      bilan,
    });
  }

  if (chapters.length === 0) return null;

  const statusField = footprintFields.find((f) => f.label === "Statut du couple")?.value ?? "—";
  const coverSubtitle = `${statusField} · ${footprint.postalCode || "—"} · ${formatEuro(footprint.propertyValue)}`;

  return {
    dateLabel,
    proofId,
    email,
    coverSubtitle,
    footprint: footprintFields,
    activeLevers,
    matrix: DOOR_ORDER.map((id) => buildMatrixRow(id, result, doorVerdicts)),
    chapters,
    activeDoorId,
    disclaimer: EXPORT_DISCLAIMER,
  };
}
