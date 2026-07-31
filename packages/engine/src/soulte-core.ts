import type {
  Asset,
  Liability,
  PersonId,
  SimulationInput,
  SoulteResult,
} from "@separation/schemas";
import { addMoney, eur, getNetAssetValue, getShareForPerson } from "./utils.js";

/** Taux du droit de partage (CGI art. 746) — divorce/PACS vs sortie d'indivision. */
export const DROIT_PARTAGE_RATE_MARRIAGE_PACS = 0.011;
export const DROIT_PARTAGE_RATE_CONCUBINAGE = 0.025;

/** Émoluments + CSI + débours — ordre de grandeur ~1,5 % de l'actif net. */
export const DEFAULT_EMOLUMENTS_RATE_ON_NET = 0.015;

/** Frais de sortie vente (agence + mise en vente) — ordre de grandeur ~5 % du prix brut. */
export const DEFAULT_SELLING_COSTS_RATE = 0.05;

export type ContributionMode = "none" | "share_rewrite" | "recompense";

export function droitDePartageRate(status: SimulationInput["status"]): number {
  return status === "marriage" || status === "pacs"
    ? DROIT_PARTAGE_RATE_MARRIAGE_PACS
    : DROIT_PARTAGE_RATE_CONCUBINAGE;
}

/** Communauté légale / universelle : les apports créent une récompense, pas un rewrite de parts. */
export function usesRecompenseModel(asset: Asset, input: SimulationInput): boolean {
  const total = (input.contributionA ?? 0) + (input.contributionB ?? 0);
  if (total <= 0) return false;

  if (asset.ownership.kind === "community") return true;

  if (input.status === "marriage") {
    const regime = input.marriageRegime ?? "communaute_legale";
    return regime === "communaute_legale" || regime === "communaute_universelle";
  }

  return false;
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
 * Quote-part pour le calcul de soulte.
 * - Indivision / séparation de biens : ratio d'apports si fournis (proxy créance 815-13).
 * - Communauté : parts légales inchangées (récompense gérée dans computeSoulteCore).
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

  return {
    shareA: contributionA / totalContributions,
    shareB: contributionB / totalContributions,
    contributionAdjusted: true,
    mode: "share_rewrite",
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
} {
  const contributionA = input.contributionA ?? 0;
  const contributionB = input.contributionB ?? 0;
  const { shareA, shareB, mode } = resolveEffectiveShares(asset, input);

  if (mode === "recompense") {
    // Art. 1433 / 1469 C. civ. (simplifié) : récompense = dépense d'apport, puis partage 50/50 du solde.
    const massAfter = Math.max(0, netAmount - contributionA - contributionB);
    const half = massAfter / 2;
    const claimA = half + contributionA;
    const claimB = half + contributionB;
    const amount = receiver === "A" ? claimA : claimB;
    return {
      amount,
      mode,
      recompenseA: contributionA,
      recompenseB: contributionB,
    };
  }

  const receiverShare = receiver === "A" ? shareA : shareB;
  return {
    amount: netAmount * receiverShare,
    mode,
    recompenseA: 0,
    recompenseB: 0,
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

  // Actif net négatif : pas de soulte à verser — dette résiduelle à partager.
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
    };
  }

  const { amount, mode, recompenseA, recompenseB } = computeSoulteAmount(
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
    ...(mode === "recompense"
      ? { recompenseA: eur(recompenseA), recompenseB: eur(recompenseB) }
      : {}),
  };
}
