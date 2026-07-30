import type { DoorId } from "@separation/schemas";
import { formatEuro } from "@/lib/utils";
import type { AssumptionsState, FootprintState, LabState } from "./separation-types";
import { buildLabLedger, defaultMortgagePayment, type LabLedgerModel } from "./lab-ledger-model";
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

export interface ExportBilanModel {
  scenarioTitle: string;
  dateLabel: string;
  footprint: ExportField[];
  activeLevers: ExportLeverLine[];
  ledger: LabLedgerModel;
  disclaimer: string;
}

export const EXPORT_SCENARIO_TITLES: Record<DoorId, string> = {
  keep_a: "Projet : garder le bien",
  keep_b: "Projet : l'autre garde le bien",
  sell: "Projet : vendre le bien",
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

  return lines;
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
      { label: "Crédit restant", value: formatEuro(footprint.mortgageRemaining) },
      { label: "Vos revenus nets", value: `${formatEuro(footprint.incomeA)}/mois` },
      { label: "Revenus de l'autre partie", value: `${formatEuro(footprint.incomeB)}/mois` },
    ],
    activeLevers: buildActiveLeverLines(lab, footprint, assumptions),
    ledger,
    disclaimer:
      "Document généré par Clarté. Ces chiffres sont indicatifs — pour valider votre projet, échangez avec un notaire ou un conseiller de confiance.",
  };
}
