import type {
  AffordabilityVerdict,
  DoorId,
  DoorVerdictMap,
  SimulationResult,
} from "@separation/schemas";
import { formatEuro } from "@/lib/utils";
import type { FootprintState } from "./separation-types";
import { ownershipCaption, resolveOwnershipPercents } from "./empreinte-context";

export const DOOR_ORDER: DoorId[] = ["keep_a", "keep_b", "sell", "sell_rent", "rent_out"];

const DOOR_TITLES: Record<DoorId, string> = {
  keep_a: "Vous rachetez",
  keep_b: "L'autre rachète",
  sell: "Vendre pour se reloger",
  sell_rent: "Vendre puis louer",
  rent_out: "Garder et louer",
};

export interface PorteBilateralShare {
  personKey: "A" | "B";
  personLabel: string;
  amount: string;
  caption: string;
  relocateLabel?: string;
  relocateVerdict?: AffordabilityVerdict;
}

export interface PortePresentation {
  doorId: DoorId;
  title: string;
  heroValue: string;
  heroCaption: string;
  consequence: string;
  verdict: DoorVerdictMap[DoorId]["verdict"];
  verdictLabel: string;
  /** Affichage côte à côte (portes sell / sell_rent). */
  bilateral?: PorteBilateralShare[];
}

function scenarioFor(result: SimulationResult, doorId: DoorId) {
  return result.scenarios.find((s) => s.scenario === doorId);
}

function buildKeepPresentation(
  doorId: "keep_a" | "keep_b",
  result: SimulationResult,
  footprint?: FootprintState | null
): Pick<PortePresentation, "heroValue" | "heroCaption" | "consequence" | "bilateral"> {
  const scenario = scenarioFor(result, doorId);
  const keepExisting = scenario?.keepFinancingMode === "keep_existing_loan";
  const negativeEquity =
    scenario?.negativeEquity === true || scenario?.soulte?.negativeEquity === true;
  const departing = scenario?.departurePersonId ?? (doorId === "keep_a" ? "B" : "A");
  const departureCapital =
    scenario?.departureCapital?.amount ?? scenario?.soulte?.amount.amount ?? 0;
  const departureRelocate =
    scenario?.departureRelocateVerdict ?? scenario?.relocateVerdictByPerson?.[departing];
  const { shareA, shareB } = resolveOwnershipPercents(
    footprint ??
      ({ ownershipShareA: 50, ownershipShareB: 50, cadreJuridiqueDeclared: false } as FootprintState)
  );
  const boughtPct = doorId === "keep_a" ? shareB : shareA;

  const bilateral: PorteBilateralShare[] = [
    {
      personKey: doorId === "keep_a" ? "A" : "B",
      personLabel: doorId === "keep_a" ? "Vous (rachetez)" : "L'autre (rachete)",
      amount: formatEuro(
        keepExisting
          ? (scenario?.newLoanAmount?.amount ?? scenario?.cashNeeded?.amount ?? 0)
          : (scenario?.cashNeeded?.amount ??
            scenario?.soulte?.refinanceAmount?.amount ??
            scenario?.soulte?.amount.amount ??
            0)
      ),
      caption: keepExisting
        ? `à emprunter (rachat ${boughtPct} %)`
        : `financement rachat (${boughtPct} %)`,
    },
    {
      personKey: departing,
      personLabel: doorId === "keep_a" ? "L'autre (part)" : "Vous (partez)",
      amount: formatEuro(departureCapital),
      caption: footprint
        ? `capital net · ${ownershipCaption(departing, footprint)}`
        : "capital net récupéré",
      relocateLabel: relocateLabel(departureRelocate),
      relocateVerdict: departureRelocate,
    },
  ];

  if (negativeEquity) {
    const residual = scenario?.soulte?.residualDebt?.amount ?? 0;
    return {
      heroValue: formatEuro(residual),
      heroCaption: "dette résiduelle à partager",
      consequence: "Actif net négatif — dette à partager",
      bilateral,
    };
  }

  const financing = keepExisting
    ? (scenario?.newLoanAmount?.amount ??
      scenario?.cashNeeded?.amount ??
      scenario?.soulte?.totalCashNeeded?.amount ??
      0)
    : (scenario?.cashNeeded?.amount ??
      scenario?.soulte?.refinanceAmount?.amount ??
      scenario?.soulte?.totalCashNeeded?.amount ??
      scenario?.soulte?.amount.amount ??
      0);
  const monthly = scenario?.monthlyPaymentEstimate?.amount ?? 0;
  const keeperPhrase =
    doorId === "keep_a" ? "Vous conservez le bien" : "L'autre partie conserve le bien";
  const indemnity = scenario?.occupationIndemnity?.amount ?? 0;

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
        ? `${keeperPhrase} · mensualité ${formatEuro(monthly)}/mois · partant ${formatEuro(departureCapital)}${indemnity > 0 ? " (dont indemnité)" : ""}`
        : `${keeperPhrase} · partant récupère ${formatEuro(departureCapital)}`,
    bilateral,
  };
}

function relocateLabel(verdict?: AffordabilityVerdict): string {
  if (verdict === "green") return "Relogement solo tenable";
  if (verdict === "orange") return "Relogement solo serré";
  if (verdict === "red") return "Relogement solo difficile";
  return "Relogement solo à évaluer";
}

function rentLabel(verdict?: AffordabilityVerdict): string {
  if (verdict === "green") return "Loyer solo tenable";
  if (verdict === "orange") return "Loyer solo serré";
  if (verdict === "red") return "Loyer solo difficile";
  return "Loyer solo à évaluer";
}

function buildSellPresentation(
  doorId: "sell" | "sell_rent",
  result: SimulationResult,
  verdict: DoorVerdictMap[DoorId],
  footprint?: FootprintState | null
): Pick<PortePresentation, "heroValue" | "heroCaption" | "consequence" | "bilateral"> {
  const scenario = scenarioFor(result, doorId);
  const you = scenario?.saleProceedsByPerson?.A.amount ?? scenario?.netWorthByPerson.A.amount ?? 0;
  const other = scenario?.saleProceedsByPerson?.B.amount ?? scenario?.netWorthByPerson.B.amount ?? 0;
  const negativeEquity = scenario?.negativeEquity === true;
  const relocateA = scenario?.relocateVerdictByPerson?.A;
  const relocateB = scenario?.relocateVerdictByPerson?.B;
  const { shareA, shareB } = resolveOwnershipPercents(
    footprint ??
      ({ ownershipShareA: 50, ownershipShareB: 50, cadreJuridiqueDeclared: false } as FootprintState)
  );
  const outcomeLabel = doorId === "sell_rent" ? rentLabel : relocateLabel;

  const bilateral: PorteBilateralShare[] = [
    {
      personKey: "A",
      personLabel: "Vous",
      amount: formatEuro(Math.abs(you)),
      caption: negativeEquity ? `dette · ${shareA} %` : `net après frais · ${shareA} %`,
      relocateLabel: outcomeLabel(relocateA),
      relocateVerdict: relocateA,
    },
    {
      personKey: "B",
      personLabel: "L'autre",
      amount: formatEuro(Math.abs(other)),
      caption: negativeEquity ? `dette · ${shareB} %` : `net après frais · ${shareB} %`,
      relocateLabel: outcomeLabel(relocateB),
      relocateVerdict: relocateB,
    },
  ];

  if (negativeEquity) {
    return {
      heroValue: formatEuro(Math.abs(you)),
      heroCaption: `votre quote-part de dette (${shareA} %)`,
      consequence: "Actif net négatif — dette à partager",
      bilateral,
    };
  }

  if (doorId === "sell_rent") {
    const rent = scenario?.tenantRentMonthly?.amount ?? scenario?.monthlyPaymentEstimate?.amount ?? 0;
    return {
      heroValue: formatEuro(you),
      heroCaption: `votre part nette (${shareA} %)`,
      consequence:
        rent > 0
          ? `Puis location zone ~${formatEuro(rent)}/mois`
          : verdict.headline,
      bilateral,
    };
  }

  return {
    heroValue: formatEuro(you),
    heroCaption: `votre part nette (${shareA} %)`,
    consequence: verdict.headline,
    bilateral,
  };
}

function buildRentPresentation(
  result: SimulationResult,
  verdict: DoorVerdictMap[DoorId],
  footprint?: FootprintState | null
): Pick<PortePresentation, "heroValue" | "heroCaption" | "consequence" | "bilateral"> {
  const scenario = scenarioFor(result, "rent_out");
  const net =
    scenario?.rentOutBreakdown?.netCashflow.amount ??
    scenario?.monthlyPaymentEstimate?.amount ??
    0;
  const prefix = net > 0 ? "+" : net < 0 ? "−" : "";
  const cashA = scenario?.monthlyNetCashflow?.A.amount;
  const cashB = scenario?.monthlyNetCashflow?.B.amount;
  const { shareA, shareB } = resolveOwnershipPercents(
    footprint ??
      ({ ownershipShareA: 50, ownershipShareB: 50, cadreJuridiqueDeclared: false } as FootprintState)
  );

  const bilateral: PorteBilateralShare[] | undefined =
    cashA != null && cashB != null
      ? [
          {
            personKey: "A",
            personLabel: "Vous",
            amount: `${cashA >= 0 ? "+" : "−"}${formatEuro(Math.abs(cashA))}`,
            caption: `quote-part / mois · ${shareA} %`,
          },
          {
            personKey: "B",
            personLabel: "L'autre",
            amount: `${cashB >= 0 ? "+" : "−"}${formatEuro(Math.abs(cashB))}`,
            caption: `quote-part / mois · ${shareB} %`,
          },
        ]
      : undefined;

  return {
    heroValue: `${prefix}${formatEuro(Math.abs(net))}`,
    heroCaption: "cashflow net / mois",
    consequence: verdict.detail || verdict.headline,
    bilateral,
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
  doorVerdicts: DoorVerdictMap | null,
  footprint?: FootprintState | null
): PortePresentation | null {
  if (!result || !doorVerdicts) return null;

  const verdict = doorVerdicts[doorId];
  let content: Pick<
    PortePresentation,
    "heroValue" | "heroCaption" | "consequence" | "bilateral"
  >;

  switch (doorId) {
    case "keep_a":
    case "keep_b":
      content = buildKeepPresentation(doorId, result, footprint);
      break;
    case "sell":
    case "sell_rent":
      content = buildSellPresentation(doorId, result, verdict, footprint);
      break;
    case "rent_out":
      content = buildRentPresentation(result, verdict, footprint);
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
  doorVerdicts: DoorVerdictMap | null,
  footprint?: FootprintState | null
): PortePresentation[] {
  return DOOR_ORDER.map((id) =>
    buildPortePresentation(id, result, doorVerdicts, footprint)
  ).filter((p): p is PortePresentation => p != null);
}

export function isValidDoorId(value: string): value is DoorId {
  return DOOR_ORDER.includes(value as DoorId);
}
