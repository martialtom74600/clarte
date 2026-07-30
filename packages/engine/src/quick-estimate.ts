import type {
  Asset,
  Liability,
  PersonId,
  QuickEstimateInput,
  QuickEstimateResult,
  SimulationInput,
  UserIntent,
} from "@separation/schemas";
import { computeSoulteCore, droitDePartageRate } from "./soulte-core.js";
import { eur, getNetAssetValue } from "./utils.js";

const DEFAULT_VARIANCE = 0.2;

function intentToKeeper(intent: UserIntent): PersonId {
  switch (intent) {
    case "keep_home":
      return "A";
    case "walk_away":
      return "B";
    case "amiable_path":
      return "A";
  }
}

function buildOwnership(input: QuickEstimateInput): Asset["ownership"] {
  if (input.status === "marriage" && input.marriageRegime === "communaute_legale") {
    return { kind: "community" };
  }
  const shareA = (input.shareA ?? 50) / 100;
  const shareB = (input.shareB ?? 50) / 100;
  return { kind: "indivision", shares: { A: shareA, B: shareB } };
}

function buildResponsibility(input: QuickEstimateInput): Liability["responsibility"] {
  if (input.status === "marriage" && input.marriageRegime === "communaute_legale") {
    return { kind: "community" };
  }
  const shareA = (input.shareA ?? 50) / 100;
  const shareB = (input.shareB ?? 50) / 100;
  return { kind: "indivision", shares: { A: shareA, B: shareB } };
}

function buildMinimalInput(
  input: QuickEstimateInput,
  propertyValue: number
): SimulationInput {
  const asset: Asset = {
    id: "primary-residence",
    type: "real_estate",
    label: "Résidence principale",
    grossValue: eur(propertyValue),
    ownership: buildOwnership(input),
    isPrimaryResidence: true,
    linkedLiabilityIds: input.mortgageRemaining > 0 ? ["mortgage"] : undefined,
  };

  const liabilities: Liability[] =
    input.mortgageRemaining > 0
      ? [
          {
            id: "mortgage",
            type: "mortgage",
            label: "Crédit immobilier",
            remainingBalance: eur(input.mortgageRemaining),
            responsibility: buildResponsibility(input),
            linkedAssetId: "primary-residence",
          },
        ]
      : [];

  return {
    status: input.status,
    marriageRegime:
      input.status === "marriage" ? (input.marriageRegime ?? "communaute_legale") : undefined,
    persons: [{ id: "A" }, { id: "B" }],
    assets: [asset],
    liabilities,
    options: {
      primaryResidenceId: "primary-residence",
      scenario: "keep_a",
      // Optionnel : override du seul taux d'émoluments sur l'actif net (pas un % de soulte).
      notaryFeesRate: input.notaryFeesRate,
    },
  };
}

function computeSoulteForValue(input: QuickEstimateInput, propertyValue: number) {
  const simInput = buildMinimalInput(input, propertyValue);
  const asset = simInput.assets[0];
  const keeper = intentToKeeper(input.intent);
  return computeSoulteCore(asset, simInput.liabilities, keeper, simInput);
}

export function runQuickEstimate(input: QuickEstimateInput): QuickEstimateResult {
  const variance = input.propertyValueVariance ?? DEFAULT_VARIANCE;
  const baseValue = input.propertyValue;
  const lowValue = Math.max(0, baseValue * (1 - variance));
  const highValue = baseValue * (1 + variance);

  const midSoulte = computeSoulteForValue(input, baseValue);
  const lowSoulte = computeSoulteForValue(input, lowValue);
  const highSoulte = computeSoulteForValue(input, highValue);

  const midAmount = midSoulte.amount.amount;
  const minAmount = Math.min(lowSoulte.amount.amount, highSoulte.amount.amount, midAmount);
  const maxAmount = Math.max(lowSoulte.amount.amount, highSoulte.amount.amount, midAmount);

  const simInput = buildMinimalInput(input, baseValue);
  const netEquity = getNetAssetValue(simInput.assets[0], simInput.liabilities);
  const partagePct = (droitDePartageRate(input.status) * 100).toFixed(2).replace(".", ",");

  const assumptions = [
    input.propertyValueMode === "manual"
      ? {
          code: "MANUAL_VALUE",
          label: `Valeur déclarée : ${baseValue.toLocaleString("fr-FR")} € (estimation personnelle, agence ou notaire)`,
        }
      : input.propertySurface && input.postalCode
        ? {
            code: "DVF_ESTIMATE",
            label: `Marché local ${input.postalCode} : médiane DVF × ${input.propertySurface} m² ≈ ${baseValue.toLocaleString("fr-FR")} €`,
          }
        : {
            code: "DVF_ESTIMATE",
            label: `Valeur estimée à ${baseValue.toLocaleString("fr-FR")} € (données de marché)`,
          },
    {
      code: "VARIANCE",
      label: `Fourchette ±${Math.round(variance * 100)} % sur la valeur du bien`,
    },
    {
      code: "NOTARY",
      label: `Droit de partage ${partagePct} % de l'actif net (CGI 746) + émoluments ~1,5 %`,
    },
    {
      code: "KEEPER",
      label:
        input.intent === "keep_home"
          ? "Hypothèse : vous conservez le logement"
          : input.intent === "walk_away"
            ? "Hypothèse : l'autre partie conserve le logement"
            : "Hypothèse : rachat par une des deux parties (scénario amiable)",
    },
  ];

  if (input.status === "marriage" && input.marriageRegime === "communaute_legale") {
    assumptions.push({
      code: "REGIME",
      label: "Régime : communauté légale — bien commun par défaut",
    });
  } else if (input.shareA !== undefined) {
    assumptions.push({
      code: "SHARES",
      label: `Quote-part ${input.shareA ?? 50} % / ${input.shareB ?? 50} %`,
    });
  }

  let confidence: QuickEstimateResult["confidence"] = "medium";
  if (baseValue <= 0) {
    confidence = "low";
  } else if (input.propertyValueMode === "manual" && variance <= 0.05) {
    confidence = "high";
  } else if (
    input.propertyValueMode === "dvf" &&
    (input.propertySurface ?? 0) >= 25 &&
    variance <= 0.2 &&
    input.mortgageRemaining >= 0
  ) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    min: eur(minAmount),
    max: eur(maxAmount),
    midpoint: eur(midAmount),
    confidence,
    assumptions,
    soulte: midSoulte,
    netEquity,
  };
}
