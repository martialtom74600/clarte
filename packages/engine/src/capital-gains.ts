import type { Asset, Money } from "@separation/schemas";
import { eur, round } from "./utils.js";

/** Taux forfaitaire d'acquisition (frais notaire) si non précisé — ~7,5 %. */
export const DEFAULT_ACQUISITION_FEES_RATE = 0.075;

/** IR sur plus-value immobilière des particuliers. */
export const CAPITAL_GAINS_IR_RATE = 0.19;

/** Prélèvements sociaux. */
export const CAPITAL_GAINS_PS_RATE = 0.172;

export interface CapitalGainsEstimate {
  exempt: boolean;
  grossGain: Money;
  taxableIr: Money;
  taxablePs: Money;
  incomeTax: Money;
  socialContributions: Money;
  /** IR + PS (+ surtaxe éventuelle). */
  totalTax: Money;
  holdingYears: number | null;
  note: string;
}

function holdingYearsSince(acquisitionDate: string | undefined, asOf = new Date()): number | null {
  if (!acquisitionDate) return null;
  const acquired = new Date(acquisitionDate);
  if (Number.isNaN(acquired.getTime())) return null;
  const ms = asOf.getTime() - acquired.getTime();
  if (ms < 0) return 0;
  return Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000));
}

/** Abattement IR pour durée de détention (CGI 150 VC). */
export function irAllowanceRate(holdingYears: number): number {
  if (holdingYears < 6) return 0;
  if (holdingYears >= 22) return 1;
  // 6 % / an de la 6e à la 21e année inclusive → 16 × 6 % = 96 %, + 4 % la 22e
  const years = Math.min(holdingYears, 21) - 5;
  return Math.min(1, round(years * 0.06, 4));
}

/** Abattement prélèvements sociaux (CGI 150 VC). */
export function psAllowanceRate(holdingYears: number): number {
  if (holdingYears < 6) return 0;
  if (holdingYears >= 30) return 1;
  let rate = 0;
  // 1,65 % / an de la 6e à la 21e
  const band1 = Math.min(holdingYears, 21) - 5;
  rate += band1 * 0.0165;
  if (holdingYears >= 22) rate += 0.016; // 22e année
  if (holdingYears >= 23) {
    const band3 = Math.min(holdingYears, 30) - 22;
    rate += band3 * 0.09;
  }
  return Math.min(1, round(rate, 4));
}

/** Surtaxe sur PV nette IR > 50 000 € (barème simplifié). */
export function capitalGainsSurtax(taxableIr: number): number {
  if (taxableIr <= 50_000) return 0;
  if (taxableIr <= 100_000) return taxableIr * 0.02;
  if (taxableIr <= 150_000) return taxableIr * 0.03;
  if (taxableIr <= 200_000) return taxableIr * 0.04;
  if (taxableIr <= 250_000) return taxableIr * 0.05;
  return taxableIr * 0.06;
}

/**
 * Estimation plus-value immobilière CGI art. 150 U / 150 VC.
 * Indicative — ne remplace pas un calcul notaire / expert-comptable.
 */
export function estimateCapitalGains(
  asset: Asset,
  salePriceAmount: number,
  asOf = new Date()
): CapitalGainsEstimate {
  if (asset.isPrimaryResidence === true) {
    return {
      exempt: true,
      grossGain: eur(0),
      taxableIr: eur(0),
      taxablePs: eur(0),
      incomeTax: eur(0),
      socialContributions: eur(0),
      totalTax: eur(0),
      holdingYears: holdingYearsSince(asset.acquisitionDate, asOf),
      note: "Plus-value : exonération résidence principale (CGI art. 150 U) — indicative.",
    };
  }

  const purchase = asset.purchasePrice?.amount;
  if (purchase == null || purchase <= 0) {
    return {
      exempt: false,
      grossGain: eur(0),
      taxableIr: eur(0),
      taxablePs: eur(0),
      incomeTax: eur(0),
      socialContributions: eur(0),
      totalTax: eur(0),
      holdingYears: holdingYearsSince(asset.acquisitionDate, asOf),
      note: "Plus-value : bien hors résidence principale — prix d'acquisition requis pour estimer l'impôt (CGI art. 150 U / 150 VC). Non chiffrée ici.",
    };
  }

  const feesRate = asset.acquisitionFeesRate ?? DEFAULT_ACQUISITION_FEES_RATE;
  const works = asset.improvementWorks?.amount ?? round(purchase * 0.15); // forfait 15 % si non détaillé
  const costBasis = purchase * (1 + feesRate) + works;
  const grossGainAmt = round(salePriceAmount - costBasis);
  const years = holdingYearsSince(asset.acquisitionDate, asOf);

  if (grossGainAmt <= 0) {
    return {
      exempt: false,
      grossGain: eur(grossGainAmt),
      taxableIr: eur(0),
      taxablePs: eur(0),
      incomeTax: eur(0),
      socialContributions: eur(0),
      totalTax: eur(0),
      holdingYears: years,
      note: "Plus-value : aucune plus-value brute estimée (prix de cession ≤ prix de revient).",
    };
  }

  if (years == null) {
    // Sans durée : taxation pleine (conservateur) + note.
    const ir = round(grossGainAmt * CAPITAL_GAINS_IR_RATE);
    const ps = round(grossGainAmt * CAPITAL_GAINS_PS_RATE);
    const surtax = round(capitalGainsSurtax(grossGainAmt));
    return {
      exempt: false,
      grossGain: eur(grossGainAmt),
      taxableIr: eur(grossGainAmt),
      taxablePs: eur(grossGainAmt),
      incomeTax: eur(ir + surtax),
      socialContributions: eur(ps),
      totalTax: eur(ir + ps + surtax),
      holdingYears: null,
      note: `Plus-value brute ~${Math.round(grossGainAmt).toLocaleString("fr-FR")} € — durée de détention absente : abattements non appliqués (hypothèse défavorable). Impôt indicatif ~${Math.round(ir + ps + surtax).toLocaleString("fr-FR")} € (CGI 150 VC).`,
    };
  }

  const irAllow = irAllowanceRate(years);
  const psAllow = psAllowanceRate(years);
  const taxableIrAmt = round(grossGainAmt * (1 - irAllow));
  const taxablePsAmt = round(grossGainAmt * (1 - psAllow));
  const ir = round(taxableIrAmt * CAPITAL_GAINS_IR_RATE);
  const ps = round(taxablePsAmt * CAPITAL_GAINS_PS_RATE);
  const surtax = round(capitalGainsSurtax(taxableIrAmt));
  const total = ir + ps + surtax;

  const note =
    irAllow >= 1 && psAllow >= 1
      ? `Plus-value : exonération totale après ${years} ans de détention (CGI 150 VC).`
      : `Plus-value brute ~${Math.round(grossGainAmt).toLocaleString("fr-FR")} € · détention ${years} ans · abatt. IR ${(irAllow * 100).toFixed(0)} % / PS ${(psAllow * 100).toFixed(1).replace(".", ",")} % · impôt indicatif ~${Math.round(total).toLocaleString("fr-FR")} € (CGI 150 U / 150 VC).`;

  return {
    exempt: total === 0,
    grossGain: eur(grossGainAmt),
    taxableIr: eur(taxableIrAmt),
    taxablePs: eur(taxablePsAmt),
    incomeTax: eur(ir + surtax),
    socialContributions: eur(ps),
    totalTax: eur(total),
    holdingYears: years,
    note,
  };
}
