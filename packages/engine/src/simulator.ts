import type {
  Asset,
  LegalWarning,
  PersonId,
  SimulationInput,
  SimulationResult,
  ScenarioComparison,
  SoulteResult,
} from "@separation/schemas";
import {
  DEFAULT_DISCLAIMERS,
  RULE_PACK_VERSION,
  addMoney,
  eur,
  estimateMonthlyPayment,
  getNetAssetValue,
  getPersonShareOfAsset,
  getShareForPerson,
  multiplyMoney,
  normalizePatrimony,
  round,
  subtractMoney,
} from "./utils.js";
import { computeSoulteCore, DEFAULT_SELLING_COSTS_RATE } from "./soulte-core.js";
import { rentPerSqm } from "./affordability.js";

const CHARGES_ESTIMATE_MONTHLY = 180;

export const BANK_KEEP_LOAN_DISCLAIMER =
  "La désolidarisation de l'emprunt initial est soumise à l'accord discrétionnaire de la banque (ratio d'endettement et solvabilité du repreneur). Ce mode n'est pas garanti.";

export interface Strategy {
  computeBaseNetWorth(input: SimulationInput): Record<PersonId, import("@separation/schemas").Money>;
  classifyAsset(asset: Asset, input: SimulationInput): "community" | "own_a" | "own_b" | "indivision";
}

function applyKeepScenario(
  input: SimulationInput,
  keeper: PersonId,
  baseNet: Record<PersonId, import("@separation/schemas").Money>,
  primaryAsset: Asset
): { netWorth: Record<PersonId, import("@separation/schemas").Money>; soulte: SoulteResult } {
  const soulte = computeSoulteCore(primaryAsset, input.liabilities, keeper, input);
  const netWorth = { ...baseNet };

  netWorth[soulte.payer] = subtractMoney(netWorth[soulte.payer], soulte.amount);
  netWorth[soulte.receiver] = addMoney(netWorth[soulte.receiver], soulte.amount);

  return { netWorth, soulte };
}

function buildRentOutScenario(
  input: SimulationInput,
  baseNet: Record<PersonId, import("@separation/schemas").Money>,
  primaryAsset: Asset
): ScenarioComparison {
  const shareA = getShareForPerson(primaryAsset.ownership, "A");
  const shareB = getShareForPerson(primaryAsset.ownership, "B");
  const mortgage = input.liabilities.find((l) => l.type === "mortgage");
  const mortgageRate = input.options.mortgageRate ?? 0.0385;
  const mortgageYears = input.options.mortgageDurationYears ?? 20;
  const mortgagePay =
    input.monthlyMortgagePayment && input.monthlyMortgagePayment > 0
      ? input.monthlyMortgagePayment
      : mortgage
        ? estimateMonthlyPayment(
            mortgage.remainingBalance.amount,
            mortgageRate,
            mortgageYears
          ).amount
        : 0;

  const postalCode = input.postalCode ?? "75000";
  const surface = input.propertySurface ?? 65;
  const grossRent =
    input.options.monthlyRentOverride && input.options.monthlyRentOverride > 0
      ? round(input.options.monthlyRentOverride)
      : round(rentPerSqm(postalCode) * surface);
  const netRent = grossRent - mortgagePay - CHARGES_ESTIMATE_MONTHLY;
  const monthlyNetCashflow = {
    A: eur(netRent * shareA),
    B: eur(netRent * shareB),
  };

  return {
    scenario: "rent_out",
    label: "Garder et louer",
    netWorthByPerson: baseNet,
    monthlyNetCashflow,
    monthlyPaymentEstimate: eur(netRent),
    description:
      netRent >= 0
        ? `Location estimée (${postalCode}, ${surface} m²) : excédent net ~${Math.round(netRent).toLocaleString("fr-FR")} €/mois après crédit (réparti selon quote-part).`
        : `Location estimée (${postalCode}, ${surface} m²) : le loyer ne couvre pas le crédit (~${Math.round(netRent).toLocaleString("fr-FR")} €/mois).`,
  };
}

function buildScenario(
  input: SimulationInput,
  scenario: "keep_a" | "keep_b" | "sell" | "rent_out",
  baseNet: Record<PersonId, import("@separation/schemas").Money>,
  primaryAsset?: Asset
): ScenarioComparison {
  const mortgageRate = input.options.mortgageRate ?? 0.0385;
  const mortgageYears = input.options.mortgageDurationYears ?? 20;

  if (scenario === "rent_out" && primaryAsset) {
    return buildRentOutScenario(input, baseNet, primaryAsset);
  }

  if (scenario === "sell" && primaryAsset) {
    const sellingCostsRate =
      input.options.sellingCostsRate ?? DEFAULT_SELLING_COSTS_RATE;
    const sellingCosts = eur(primaryAsset.grossValue.amount * sellingCostsRate);
    const equityBeforeCosts = getNetAssetValue(primaryAsset, input.liabilities);
    const saleNetProceeds = eur(equityBeforeCosts.amount - sellingCosts.amount);
    const shareA = getShareForPerson(primaryAsset.ownership, "A");
    const shareB = getShareForPerson(primaryAsset.ownership, "B");
    const netWorth = {
      A: addMoney(
        subtractMoney(baseNet.A, getPersonShareOfAsset(primaryAsset, "A", input.liabilities)),
        multiplyMoney(saleNetProceeds, shareA)
      ),
      B: addMoney(
        subtractMoney(baseNet.B, getPersonShareOfAsset(primaryAsset, "B", input.liabilities)),
        multiplyMoney(saleNetProceeds, shareB)
      ),
    };
    const negativeEquity = saleNetProceeds.amount < 0;
    const costsPct = Math.round(sellingCostsRate * 100);

    return {
      scenario: "sell",
      label: "Vendre le logement",
      netWorthByPerson: netWorth,
      sellingCostsEstimate: sellingCosts,
      saleNetProceeds,
      negativeEquity,
      description: negativeEquity
        ? `Actif net négatif après frais de sortie (~${costsPct} %) et remboursement du crédit — dette à partager selon les quote-parts.`
        : `Chaque partie récupère sa quote-part du produit net après frais de sortie (~${costsPct} % agence / mise en vente) et remboursement du crédit.`,
    };
  }

  if (!primaryAsset) {
    return {
      scenario,
      label: scenario === "keep_a" ? "Personne A garde" : "Personne B garde",
      netWorthByPerson: baseNet,
      description: "Aucun bien immobilier identifié pour ce scénario.",
    };
  }

  const keeper: PersonId = scenario === "keep_a" ? "A" : "B";
  const { netWorth, soulte } = applyKeepScenario(input, keeper, baseNet, primaryAsset);
  const soulteCash =
    soulte.totalCashNeeded?.amount ?? soulte.amount.amount;
  const fullRefinance =
    soulte.refinanceAmount?.amount ?? soulteCash;

  // Levier « garder mon crédit » : monthlyMortgagePayment > 0 → on conserve le CRD
  // aux conditions actuelles et on ne refinance que le rachat + frais.
  const keepExistingLoan =
    input.monthlyMortgagePayment != null && input.monthlyMortgagePayment > 0;

  if (keepExistingLoan) {
    const newLoanAmount = soulteCash;
    const newLoanMonthly = estimateMonthlyPayment(
      newLoanAmount,
      mortgageRate,
      mortgageYears
    );
    const keptMonthly = input.monthlyMortgagePayment!;
    const totalMonthly = eur(keptMonthly + newLoanMonthly.amount);

    return {
      scenario,
      label: keeper === "A" ? "Personne A rachète" : "Personne B rachète",
      netWorthByPerson: netWorth,
      soulte,
      monthlyPaymentEstimate: totalMonthly,
      cashNeeded: eur(newLoanAmount),
      keepFinancingMode: "keep_existing_loan",
      keptMortgageMonthly: eur(keptMonthly),
      newLoanAmount: eur(newLoanAmount),
      newLoanMonthly,
      bankDisclaimer: BANK_KEEP_LOAN_DISCLAIMER,
      negativeEquity: soulte.negativeEquity === true,
      description: soulte.negativeEquity
        ? `Actif net négatif — dette à partager. Hypothèse indicative : conservation du crédit actuel (${Math.round(keptMonthly).toLocaleString("fr-FR")} €/mois), sous accord banque.`
        : `${keeper === "A" ? "A" : "B"} conserve le logement et le crédit actuel (${Math.round(keptMonthly).toLocaleString("fr-FR")} €/mois), et finance uniquement le rachat (~${Math.round(newLoanAmount).toLocaleString("fr-FR")} €). Sous réserve d'accord banque (désolidarisation).`,
    };
  }

  // Défaut C4 — refinancement global CRD + soulte + frais aux taux marché.
  const monthlyPayment = estimateMonthlyPayment(
    fullRefinance,
    mortgageRate,
    mortgageYears
  );

  return {
    scenario,
    label: keeper === "A" ? "Personne A rachète" : "Personne B rachète",
    netWorthByPerson: netWorth,
    soulte,
    monthlyPaymentEstimate: monthlyPayment,
    cashNeeded: soulte.refinanceAmount ?? soulte.totalCashNeeded ?? soulte.amount,
    keepFinancingMode: "full_refinance",
    newLoanAmount: eur(fullRefinance),
    newLoanMonthly: monthlyPayment,
    negativeEquity: soulte.negativeEquity === true,
    description: soulte.negativeEquity
      ? `Actif net négatif — dette à partager (~${Math.round(Math.abs(soulte.netAssetValue.amount)).toLocaleString("fr-FR")} €). Pas de soulte ; refinancement du CRD estimé à ${Math.round(fullRefinance).toLocaleString("fr-FR")} €.`
      : `${keeper === "A" ? "A" : "B"} conserve le logement et verse une soulte de ${soulte.amount.amount.toLocaleString("fr-FR")} € à l'autre partie (refinancement estimé ${Math.round(fullRefinance).toLocaleString("fr-FR")} €).`,
  };
}

export function computeComplexityScore(input: SimulationInput): number {
  let score = 0;

  if (input.status === "marriage") score += 15;
  if (input.marriageRegime === "communaute_legale") score += 10;
  if (input.marriageRegime === "communaute_universelle") score += 5;

  const hasIndivision = input.assets.some((a) => a.ownership.kind === "indivision");
  if (hasIndivision) score += 10;

  const hasMortgage = input.liabilities.some((l) => l.type === "mortgage");
  if (hasMortgage) score += 15;

  const hasOwnAssets = input.assets.some((a) => a.ownership.kind === "own");
  if (hasOwnAssets && input.status === "marriage") score += 20;

  if (input.hasMinorChildren) score += 15;

  const totalValue = input.assets.reduce((s, a) => s + a.grossValue.amount, 0);
  if (totalValue > 500000) score += 20;
  else if (totalValue > 150000) score += 10;

  const hasBusiness = input.assets.some((a) => a.type === "investment");
  if (hasBusiness) score += 25;

  return Math.min(100, score);
}

export function computeWarnings(input: SimulationInput): LegalWarning[] {
  const warnings: LegalWarning[] = [];

  const primaryAsset =
    input.assets.find((a) => a.id === input.options.primaryResidenceId) ??
    input.assets.find((a) => a.type === "real_estate");
  if (primaryAsset) {
    const net = getNetAssetValue(primaryAsset, input.liabilities);
    if (net.amount < 0) {
      warnings.push({
        code: "NEGATIVE_EQUITY",
        severity: "critical",
        message:
          "Actif net négatif — dette à partager : le crédit restant dépasse la valeur estimée du bien. Aucune soulte n'est due ; la dette résiduelle doit être anticipée avec la banque et un notaire.",
      });
    }
  }

  if (
    input.monthlyMortgagePayment != null &&
    input.monthlyMortgagePayment > 0 &&
    (input.options.scenario === "keep_a" ||
      input.options.scenario === "keep_b" ||
      input.options.scenario === "compare_all")
  ) {
    warnings.push({
      code: "BANK_DISSOLIDARIZATION",
      severity: "warning",
      message: BANK_KEEP_LOAN_DISCLAIMER,
    });
  }

  if (input.hasMinorChildren) {
    warnings.push({
      code: "MINOR_CHILDREN",
      severity: "warning",
      message:
        "La présence d'enfants mineurs peut impliquer l'intervention du juge aux affaires familiales pour le logement familial.",
    });
  }

  const totalValue = input.assets.reduce((s, a) => s + a.grossValue.amount, 0);
  if (totalValue > 500000) {
    warnings.push({
      code: "HIGH_PATRIMONY",
      severity: "info",
      message:
        "Patrimoine significatif : un notaire est fortement recommandé pour sécuriser la répartition.",
    });
  }

  const mixedOwnership = input.assets.some(
    (a) => a.ownership.kind === "own" && input.liabilities.some(
      (l) => l.responsibility.kind === "community" && l.linkedAssetId === a.id
    )
  );
  if (mixedOwnership) {
    warnings.push({
      code: "MIXED_OWNERSHIP_DEBT",
      severity: "warning",
      message:
        "Bien propre avec dette commune détecté : situation juridique complexe nécessitant un expert.",
    });
  }

  if (input.assets.some((a) => a.type === "investment")) {
    warnings.push({
      code: "BUSINESS_ASSETS",
      severity: "critical",
      message:
        "Parts sociales ou investissements professionnels : faites appel à un expert-comptable et notaire.",
    });
  }

  return warnings;
}

export class ConcubinageStrategy implements Strategy {
  computeBaseNetWorth(input: SimulationInput) {
    const { netByPerson, ownByPerson } = normalizePatrimony(input);
    return {
      A: addMoney(netByPerson.A, ownByPerson.A),
      B: addMoney(netByPerson.B, ownByPerson.B),
    };
  }

  classifyAsset(asset: Asset): "community" | "own_a" | "own_b" | "indivision" {
    if (asset.ownership.kind === "own") {
      return asset.ownership.owner === "A" ? "own_a" : "own_b";
    }
    return "indivision";
  }
}

export class PacsStrategy extends ConcubinageStrategy {
  computeBaseNetWorth(input: SimulationInput) {
    const base = super.computeBaseNetWorth(input);
    const communityAssets = input.assets.filter((a) => a.ownership.kind === "community");
    let communityNet = eur(0);
    for (const asset of communityAssets) {
      communityNet = addMoney(communityNet, getNetAssetValue(asset, input.liabilities));
    }
    if (communityNet.amount > 0) {
      return {
        A: addMoney(base.A, multiplyMoney(communityNet, 0.5)),
        B: addMoney(base.B, multiplyMoney(communityNet, 0.5)),
      };
    }
    return base;
  }
}

export class MarriageStrategy implements Strategy {
  constructor(private regime: "communaute_legale" | "separation_biens" | "communaute_universelle") {}

  computeBaseNetWorth(input: SimulationInput) {
    const { netByPerson, communityMass, ownByPerson } = normalizePatrimony(input);

    if (this.regime === "communaute_universelle") {
      let total = eur(0);
      for (const asset of input.assets) {
        total = addMoney(total, getNetAssetValue(asset, input.liabilities));
      }
      for (const liability of input.liabilities) {
        if (!liability.linkedAssetId) {
          total = subtractMoney(total, liability.remainingBalance);
        }
      }
      return {
        A: multiplyMoney(total, 0.5),
        B: multiplyMoney(total, 0.5),
      };
    }

    if (this.regime === "separation_biens") {
      return {
        A: addMoney(netByPerson.A, ownByPerson.A),
        B: addMoney(netByPerson.B, ownByPerson.B),
      };
    }

    const halfCommunity = multiplyMoney(communityMass, 0.5);
    return {
      A: addMoney(addMoney(netByPerson.A, ownByPerson.A), halfCommunity),
      B: addMoney(addMoney(netByPerson.B, ownByPerson.B), halfCommunity),
    };
  }

  classifyAsset(asset: Asset, input: SimulationInput): "community" | "own_a" | "own_b" | "indivision" {
    if (this.regime === "communaute_universelle") return "community";
    if (asset.ownership.kind === "community") return "community";
    if (asset.ownership.kind === "own") {
      return asset.ownership.owner === "A" ? "own_a" : "own_b";
    }
    if (this.regime === "communaute_legale" && input.marriageDate && asset.acquisitionDate) {
      if (asset.acquisitionDate >= input.marriageDate) return "community";
    }
    return "indivision";
  }
}

export function getStrategy(input: SimulationInput): Strategy {
  switch (input.status) {
    case "concubinage":
      return new ConcubinageStrategy();
    case "pacs":
      return new PacsStrategy();
    case "marriage":
      return new MarriageStrategy(
        input.marriageRegime ?? "communaute_legale"
      );
    default:
      return new ConcubinageStrategy();
  }
}

export function runSimulation(input: SimulationInput): SimulationResult {
  const strategy = getStrategy(input);
  const baseNet = strategy.computeBaseNetWorth(input);
  const primaryAsset = input.assets.find(
    (a) => a.id === input.options.primaryResidenceId
  ) ?? input.assets.find((a) => a.type === "real_estate");

  const scenarios: ScenarioComparison[] = [];

  if (
    input.options.scenario === "compare_all" ||
    input.options.scenario === "keep_a"
  ) {
    scenarios.push(buildScenario(input, "keep_a", baseNet, primaryAsset));
  }
  if (
    input.options.scenario === "compare_all" ||
    input.options.scenario === "keep_b"
  ) {
    scenarios.push(buildScenario(input, "keep_b", baseNet, primaryAsset));
  }
  if (
    input.options.scenario === "compare_all" ||
    input.options.scenario === "sell"
  ) {
    scenarios.push(buildScenario(input, "sell", baseNet, primaryAsset));
  }

  if (
    input.options.scenario === "compare_all" ||
    input.options.scenario === "rent_out"
  ) {
    scenarios.push(buildScenario(input, "rent_out", baseNet, primaryAsset));
  }

  const primaryScenario =
    scenarios.find((s) => s.scenario === input.options.scenario) ?? scenarios[0];

  const { communityMass } = normalizePatrimony(input);

  return {
    netWorthByPerson: baseNet,
    communityMass: communityMass.amount !== 0 ? communityMass : undefined,
    soulte: primaryScenario?.soulte,
    scenarios,
    complexityScore: computeComplexityScore(input),
    warnings: computeWarnings(input),
    disclaimers: DEFAULT_DISCLAIMERS,
    rulePackVersion: RULE_PACK_VERSION,
  };
}
