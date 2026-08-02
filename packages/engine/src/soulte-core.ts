import type {
  Asset,
  Liability,
  PersonId,
  SimulationInput,
  SoulteResult,
} from "@separation/schemas";
import { addMoney, eur, getNetAssetValue, getShareForPerson, round } from "./utils.js";

/** Taux du droit de partage (CGI art. 746) — divorce/PACS vs sortie d'indivision. */
export const DROIT_PARTAGE_RATE_MARRIAGE_PACS = 0.011;
export const DROIT_PARTAGE_RATE_CONCUBINAGE = 0.025;

/** Émoluments + CSI + débours — ordre de grandeur ~1,5 % de l'actif net. */
export const DEFAULT_EMOLUMENTS_RATE_ON_NET = 0.015;

/**
 * - none : parts légales
 * - creance : parts légales + prélèvement créances (815-13 / apports) — défaut indivision
 * - recompense : communauté art. 1433 / 1469 (avec profit si prix d'acquisition)
 * - share_rewrite : legacy — rewrite des % selon apports (opt-in via options)
 */
export type ContributionMode = "none" | "share_rewrite" | "recompense" | "creance";

export function droitDePartageRate(status: SimulationInput["status"]): number {
  return status === "marriage" || status === "pacs"
    ? DROIT_PARTAGE_RATE_MARRIAGE_PACS
    : DROIT_PARTAGE_RATE_CONCUBINAGE;
}

/**
 * Récompense (art. 1433 / 1469) uniquement si le bien est en communauté.
 * Un bien en indivision (acte / quote-parts) utilise le mode créance 815-13,
 * même pour un couple marié — le statut seul ne suffit pas.
 */
export function usesRecompenseModel(asset: Asset, input: SimulationInput): boolean {
  const total = (input.contributionA ?? 0) + (input.contributionB ?? 0);
  if (total <= 0) return false;
  return asset.ownership.kind === "community";
}

function linkedMortgageBalance(asset: Asset, liabilities: Liability[]): number {
  return liabilities
    .filter(
      (l) =>
        l.type === "mortgage" &&
        (asset.linkedLiabilityIds?.includes(l.id) || l.linkedAssetId === asset.id)
    )
    .reduce((sum, l) => sum + l.remainingBalance.amount, 0);
}

/**
 * Récompense art. 1469 : si prix d'acquisition connu, valorise le profit subsistant
 * (apport × valeur actuelle / prix d'acquisition). Sinon nominal (dépense).
 */
export function computeRecompenseAmount(
  expense: number,
  currentValue: number,
  purchasePrice?: number
): number {
  if (expense <= 0) return 0;
  if (!purchasePrice || purchasePrice <= 0) return round(expense);
  // Art. 1469 al. 3 — acquisition encore dans la masse : récompense = profit.
  return round(expense * (currentValue / purchasePrice));
}

/**
 * Quote-part pour le calcul de soulte.
 * - Indivision : parts légales + mode créance (sauf legacy share_rewrite)
 * - Communauté : parts légales + récompense
 */
export function resolveEffectiveShares(
  asset: Asset,
  input: SimulationInput
): {
  shareA: number;
  shareB: number;
  contributionAdjusted: boolean;
  mode: ContributionMode;
} {
  const legalA = getShareForPerson(asset.ownership, "A");
  const legalB = getShareForPerson(asset.ownership, "B");
  const contributionA = input.contributionA ?? 0;
  const contributionB = input.contributionB ?? 0;
  const totalContributions = contributionA + contributionB;

  if (totalContributions <= 0) {
    return { shareA: legalA, shareB: legalB, contributionAdjusted: false, mode: "none" };
  }

  if (usesRecompenseModel(asset, input)) {
    return {
      shareA: legalA,
      shareB: legalB,
      contributionAdjusted: true,
      mode: "recompense",
    };
  }

  // Legacy opt-in : rewrite des parts selon le ratio d'apports.
  if (input.options.legacyShareRewrite === true) {
    return {
      shareA: contributionA / totalContributions,
      shareB: contributionB / totalContributions,
      contributionAdjusted: true,
      mode: "share_rewrite",
    };
  }

  // Défaut 2026.6 : créance / prélèvement avant partage (parts légales conservées).
  return {
    shareA: legalA,
    shareB: legalB,
    contributionAdjusted: true,
    mode: "creance",
  };
}

function computeSoulteAmount(
  asset: Asset,
  input: SimulationInput,
  netAmount: number,
  receiver: PersonId
): {
  amount: number;
  mode: ContributionMode;
  recompenseA: number;
  recompenseB: number;
  creanceA: number;
  creanceB: number;
} {
  const contributionA = input.contributionA ?? 0;
  const contributionB = input.contributionB ?? 0;
  const { shareA, shareB, mode } = resolveEffectiveShares(asset, input);
  const purchasePrice = asset.purchasePrice?.amount;
  const currentValue = asset.grossValue.amount;

  if (mode === "recompense") {
    const recA = computeRecompenseAmount(contributionA, currentValue, purchasePrice);
    const recB = computeRecompenseAmount(contributionB, currentValue, purchasePrice);
    const massAfter = Math.max(0, netAmount - recA - recB);
    const half = massAfter / 2;
    const claimA = half + recA;
    const claimB = half + recB;
    const amount = receiver === "A" ? claimA : claimB;
    return {
      amount,
      mode,
      recompenseA: recA,
      recompenseB: recB,
      creanceA: 0,
      creanceB: 0,
    };
  }

  if (mode === "creance") {
    // Prélèvement des créances d'apport avant partage selon parts légales.
    const creA = contributionA;
    const creB = contributionB;
    const massAfter = Math.max(0, netAmount - creA - creB);
    const claimA = massAfter * shareA + creA;
    const claimB = massAfter * shareB + creB;
    const amount = receiver === "A" ? claimA : claimB;
    return {
      amount,
      mode,
      recompenseA: 0,
      recompenseB: 0,
      creanceA: creA,
      creanceB: creB,
    };
  }

  const receiverShare = receiver === "A" ? shareA : shareB;
  return {
    amount: netAmount * receiverShare,
    mode,
    recompenseA: 0,
    recompenseB: 0,
    creanceA: 0,
    creanceB: 0,
  };
}

/** Core soulte calculation shared by full simulation and quick estimate. */
export function computeSoulteCore(
  asset: Asset,
  liabilities: SimulationInput["liabilities"],
  keeper: PersonId,
  input: SimulationInput
): SoulteResult {
  const receiver: PersonId = keeper === "A" ? "B" : "A";
  const net = getNetAssetValue(asset, liabilities);
  const netAmount = net.amount;
  const mortgageRemaining = linkedMortgageBalance(asset, liabilities);
  const negativeEquity = netAmount < 0;

  if (negativeEquity) {
    return {
      payer: keeper,
      receiver,
      amount: eur(0),
      assetId: asset.id,
      assetLabel: asset.label,
      netAssetValue: net,
      notaryFeesEstimate: eur(0),
      totalCashNeeded: eur(0),
      droitDePartage: eur(0),
      emolumentsEstimate: eur(0),
      refinanceAmount: eur(mortgageRemaining),
      negativeEquity: true,
      residualDebt: eur(Math.abs(netAmount)),
      contributionMode: "none",
    };
  }

  const { amount, mode, recompenseA, recompenseB, creanceA, creanceB } = computeSoulteAmount(
    asset,
    input,
    netAmount,
    receiver
  );
  const soulteAmount = eur(amount);

  const partageRate = droitDePartageRate(input.status);
  const droitDePartage = eur(netAmount * partageRate);
  const emolumentsRate = input.options.notaryFeesRate ?? DEFAULT_EMOLUMENTS_RATE_ON_NET;
  const emolumentsEstimate = eur(netAmount * emolumentsRate);
  const notaryFees = addMoney(droitDePartage, emolumentsEstimate);
  const totalCashNeeded = addMoney(soulteAmount, notaryFees);

  const refinanceAmount = eur(
    mortgageRemaining + soulteAmount.amount + notaryFees.amount
  );

  return {
    payer: keeper,
    receiver,
    amount: soulteAmount,
    assetId: asset.id,
    assetLabel: asset.label,
    netAssetValue: net,
    notaryFeesEstimate: notaryFees,
    totalCashNeeded,
    droitDePartage,
    emolumentsEstimate,
    refinanceAmount,
    negativeEquity: false,
    contributionMode: mode,
    ...(mode === "recompense"
      ? { recompenseA: eur(recompenseA), recompenseB: eur(recompenseB) }
      : {}),
    ...(mode === "creance"
      ? { creanceA: eur(creanceA), creanceB: eur(creanceB) }
      : {}),
  };
}
