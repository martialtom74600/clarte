import type { DoorId, DoorVerdictMap, SimulationResult } from "@separation/schemas";
import { formatEuro } from "@/lib/utils";

export const DOOR_ORDER: DoorId[] = ["keep_a", "keep_b", "sell", "rent_out"];

const DOOR_TITLES: Record<DoorId, string> = {
  keep_a: "Vous rachetez",
  keep_b: "L'autre rachète",
  sell: "Vendre",
  rent_out: "Garder et louer",
};

export interface PortePresentation {
  doorId: DoorId;
  title: string;
  heroValue: string;
  heroCaption: string;
  consequence: string;
  verdict: DoorVerdictMap[DoorId]["verdict"];
  verdictLabel: string;
}

function scenarioFor(result: SimulationResult, doorId: DoorId) {
  return result.scenarios.find((s) => s.scenario === doorId);
}

function buildKeepPresentation(
  doorId: "keep_a" | "keep_b",
  result: SimulationResult
): Pick<PortePresentation, "heroValue" | "heroCaption" | "consequence"> {
  const scenario = scenarioFor(result, doorId);
  const keepExisting = scenario?.keepFinancingMode === "keep_existing_loan";
  const negativeEquity =
    scenario?.negativeEquity === true || scenario?.soulte?.negativeEquity === true;

  if (negativeEquity) {
    const residual = scenario?.soulte?.residualDebt?.amount ?? 0;
    return {
      heroValue: formatEuro(residual),
      heroCaption: "dette résiduelle à partager",
      consequence: "Actif net négatif — dette à partager",
    };
  }

  const financing = keepExisting
    ? (scenario?.newLoanAmount?.amount ??
      scenario?.cashNeeded?.amount ??
      scenario?.soulte?.totalCashNeeded?.amount ??
      0)
    : (scenario?.soulte?.refinanceAmount?.amount ??
      scenario?.cashNeeded?.amount ??
      scenario?.soulte?.totalCashNeeded?.amount ??
      scenario?.soulte?.amount.amount ??
      0);
  const monthly = scenario?.monthlyPaymentEstimate?.amount ?? 0;
  const keeperPhrase =
    doorId === "keep_a" ? "Vous conservez le bien" : "L'autre partie conserve le bien";

  const heroCaption = keepExisting
    ? "à emprunter en plus du crédit actuel (sous accord banque)"
    : doorId === "keep_a"
      ? "pour garder le bien"
      : "rachat de votre part";

  return {
    heroValue: formatEuro(financing),
    heroCaption,
    consequence:
      monthly > 0
        ? `${keeperPhrase} · mensualité estimée ${formatEuro(monthly)}/mois`
        : `${keeperPhrase} · montant à verser`,
  };
}

function buildSellPresentation(
  result: SimulationResult,
  verdict: DoorVerdictMap[DoorId]
): Pick<PortePresentation, "heroValue" | "heroCaption" | "consequence"> {
  const scenario = scenarioFor(result, "sell");
  const proceeds = scenario?.netWorthByPerson.A.amount ?? 0;
  const negativeEquity = scenario?.negativeEquity === true;

  if (negativeEquity) {
    return {
      heroValue: formatEuro(Math.abs(proceeds)),
      heroCaption: "votre quote-part de dette",
      consequence: "Actif net négatif — dette à partager",
    };
  }

  return {
    heroValue: formatEuro(proceeds),
    heroCaption: "votre part, net (après ~5 % frais de sortie)",
    consequence: verdict.headline,
  };
}

function buildRentPresentation(
  result: SimulationResult,
  verdict: DoorVerdictMap[DoorId]
): Pick<PortePresentation, "heroValue" | "heroCaption" | "consequence"> {
  const scenario = scenarioFor(result, "rent_out");
  const net = scenario?.monthlyPaymentEstimate?.amount ?? 0;
  const prefix = net > 0 ? "+" : net < 0 ? "−" : "";

  return {
    heroValue: `${prefix}${formatEuro(Math.abs(net))}`,
    heroCaption: "reste chaque mois",
    consequence: verdict.headline,
  };
}

const VERDICT_LABELS = {
  green: "Tenable",
  orange: "Serré",
  red: "Difficile",
} as const;

export function buildPortePresentation(
  doorId: DoorId,
  result: SimulationResult | null,
  doorVerdicts: DoorVerdictMap | null
): PortePresentation | null {
  if (!result || !doorVerdicts) return null;

  const verdict = doorVerdicts[doorId];
  let content: Pick<PortePresentation, "heroValue" | "heroCaption" | "consequence">;

  switch (doorId) {
    case "keep_a":
    case "keep_b":
      content = buildKeepPresentation(doorId, result);
      break;
    case "sell":
      content = buildSellPresentation(result, verdict);
      break;
    case "rent_out":
      content = buildRentPresentation(result, verdict);
      break;
    default:
      return null;
  }

  return {
    doorId,
    title: DOOR_TITLES[doorId],
    ...content,
    verdict: verdict.verdict,
    verdictLabel: VERDICT_LABELS[verdict.verdict],
  };
}

export function buildAllPortes(
  result: SimulationResult | null,
  doorVerdicts: DoorVerdictMap | null
): PortePresentation[] {
  return DOOR_ORDER.map((id) => buildPortePresentation(id, result, doorVerdicts)).filter(
    (p): p is PortePresentation => p != null
  );
}

export function isValidDoorId(value: string): value is DoorId {
  return DOOR_ORDER.includes(value as DoorId);
}
