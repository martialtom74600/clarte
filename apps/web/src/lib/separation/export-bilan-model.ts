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
    insights.push({
      title: `Synthèse — ${formatVerdictLabel(verdict.verdict)}`,
      body: `${verdict.headline}. ${detail.split("\n")[0] ?? detail}`,
    });
  }

  if (doorId === "keep_a" || doorId === "keep_b") {
    const departure = scenario?.departureCapital?.amount ?? scenario?.soulte?.amount.amount;
    const relocate = scenario?.departureRelocateVerdict;
    const indemnity = scenario?.occupationIndemnity?.amount ?? 0;
    if (departure != null) {
      insights.push({
        title: "Capital du partant & relogement",
        body: `Capital net récupéré : ${formatEuro(departure)}${
          indemnity > 0 ? ` (dont indemnité d'occupation ${formatEuro(indemnity)})` : ""
        }. Relogement solo : ${
          relocate ? formatAffordabilityVerdictLabel(relocate) : "à évaluer"
        }${
          scenario?.relocateHousingNote ? ` — ${scenario.relocateHousingNote}` : ""
        }${
          scenario?.relocateTarget
            ? ` (~${formatEuro(scenario.relocateTarget.amount)})`
            : ""
        }.`,
      });
    }
    if (scenario?.occupationNote) {
      insights.push({
        title: "Indemnité d'occupation",
        body: scenario.occupationNote,
      });
    }
  }

  if (doorId === "rent_out" && scenario?.rentOutBreakdown) {
    const bd = scenario.rentOutBreakdown;
    insights.push({
      title: "Détail fiscal locatif (micro-foncier)",
      body:
        `Loyer brut ${formatEuro(bd.grossRent.amount)} − vacance ${formatEuro(bd.vacancyProvision.amount)} ` +
        `→ effectif ${formatEuro(bd.effectiveRent.amount)}. ` +
        `Charges : crédit ${formatEuro(bd.mortgagePayment.amount)}, TF ${formatEuro(bd.propertyTaxMonthly.amount)}, ` +
        `PNO ${formatEuro(bd.pnoMonthly.amount)}, gestion ${formatEuro(bd.managementFees.amount)}. ` +
        `Impôts (abatt. 30 % + IR + PS) ${formatEuro(bd.incomeTaxEstimate.amount)}. ` +
        `Cashflow net : ${formatEuro(bd.netCashflow.amount)}/mois.`,
    });
    if (scenario.rentOutFormulaDetail) {
      insights.push({
        title: "Formule de cashflow",
        body: scenario.rentOutFormulaDetail,
      });
    }
  }

  if (doorId === "sell" || doorId === "sell_rent") {
    if (scenario?.capitalGainsNote) {
      insights.push({ title: "Plus-value (CGI 150 U / 150 VC)", body: scenario.capitalGainsNote });
    }
    if ((scenario?.capitalGainsEstimate?.amount ?? 0) > 0) {
      insights.push({
        title: "Impôt sur la plus-value estimé",
        body: `${formatEuro(scenario!.capitalGainsEstimate!.amount)} déduit du net vendeur (IR + PS + surtaxe éventuelle).`,
      });
    }
    if (scenario?.saleProceedsByPerson) {
      insights.push({
        title: "Répartition bilatérale après vente",
        body: `Vous ${formatEuro(scenario.saleProceedsByPerson.A.amount)} · Autre ${formatEuro(scenario.saleProceedsByPerson.B.amount)} (après agence + diagnostics + CRD ± PV).`,
      });
    }
    if (doorId === "sell_rent" && (scenario?.tenantRentMonthly?.amount ?? 0) > 0) {
      insights.push({
        title: "Loyer cible après vente",
        body: `${scenario?.relocateHousingNote ?? "Cible solo"} — ~${formatEuro(scenario!.tenantRentMonthly!.amount)}/mois.`,
      });
    } else if (doorId === "sell" && scenario?.relocateHousingNote) {
      insights.push({
        title: "Hypothèse de relogement solo",
        body: `${scenario.relocateHousingNote}${
          scenario.relocateTarget
            ? ` — prix cible ~${formatEuro(scenario.relocateTarget.amount)}`
            : ""
        }.`,
      });
    }
  }

  if (result.compensatoryAllowance?.applicable) {
    insights.push({
      title: "Prestation compensatoire (art. 270–271)",
      body: result.compensatoryAllowance.note,
    });
  }

  if (doorId === "keep_a" || doorId === "keep_b") {
    const mode = scenario?.soulte?.contributionMode;
    if (mode === "creance") {
      insights.push({
        title: "Créances d'indivision (art. 815-13)",
        body: `Apports traités en prélèvement avant partage (parts légales conservées) — créances A ${formatEuro(scenario?.soulte?.creanceA?.amount ?? 0)} / B ${formatEuro(scenario?.soulte?.creanceB?.amount ?? 0)}.`,
      });
    }
    if (mode === "recompense") {
      insights.push({
        title: "Récompenses (art. 1469)",
        body: `Récompenses A ${formatEuro(scenario?.soulte?.recompenseA?.amount ?? 0)} / B ${formatEuro(scenario?.soulte?.recompenseB?.amount ?? 0)} (profit subsistant si prix d'acquisition renseigné).`,
      });
    }
  }

  return insights;
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
    footprint: [
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
    ],
    activeLevers: buildActiveLeverLines(lab, footprint, assumptions),
    insights: buildExportInsights(doorId, result, doorVerdicts),
    ledger,
    disclaimer:
      "Document généré par Clarté (pack 2026.6). Simulation indicative : droit de partage CGI 746 + émoluments ~1,5 % ; vente = agence ~5 % + diagnostics + plus-value CGI 150 U/150 VC ; location = vacance, TF, PNO, gestion, micro-foncier ; rachat = soulte/créance 815-13 ou récompense 1469 ± indemnité d'occupation + relogement du partant ; prestation compensatoire art. 270–271 indicative. Le mode « garder mon crédit » suppose un accord banque. Consultez un notaire ou un conseiller avant toute décision.",
  };
}
