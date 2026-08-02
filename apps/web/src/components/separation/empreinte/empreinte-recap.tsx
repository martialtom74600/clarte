"use client";

import { motion } from "framer-motion";
import { formatEuro } from "@/lib/utils";
import { duration, ease } from "@/lib/motion";
import { parseCurrency, parseNumber } from "./empreinte-field";
import type { EmpreinteDraft } from "./empreinte-screens";
import type { FootprintState } from "@/lib/separation/separation-types";
import {
  resolveFinancementValues,
  type ResolvedFinancementValues,
} from "./empreinte-amortization";

function derivePurchasePrice(
  draft: EmpreinteDraft,
  footprint: FootprintState,
  resolved: ResolvedFinancementValues
): number | null {
  const principal = resolved.initialMortgagePrincipal;
  const contribA =
    (draft.contributionA ?? "").trim() !== ""
      ? parseCurrency(draft.contributionA ?? "")
      : footprint.contributionA;
  const contribB =
    (draft.contributionB ?? "").trim() !== ""
      ? parseCurrency(draft.contributionB ?? "")
      : footprint.contributionB;

  if (principal > 0) return principal + contribA + contribB;
  if (contribA + contribB > 0) return contribA + contribB;
  return null;
}

/** Récapitulatif patrimoine + financement — affiché après apports + crédit. */
export function EmpreinteRecap({
  draft,
  footprint,
  financementDraft,
}: {
  draft: EmpreinteDraft;
  footprint: FootprintState;
  /** Draft fusionné financement (mode actif appliqué) pour prévisualiser le CRD. */
  financementDraft?: EmpreinteDraft;
}) {
  const activeDraft = financementDraft ?? draft;
  const resolved =
    footprint.financementDeclared && !financementDraft
      ? {
          mortgageRemaining: footprint.mortgageRemaining,
          monthlyMortgagePayment: footprint.monthlyMortgagePayment,
          mortgageRemainingYears: footprint.mortgageRemainingYears,
          initialMortgagePrincipal: footprint.initialMortgagePrincipal,
          initialMortgageDurationYears: footprint.initialMortgageDurationYears,
          mortgageStartMonth: footprint.mortgageStartMonth,
          mortgageStartYear: footprint.mortgageStartYear,
          initialMortgageRate: footprint.initialMortgageRate,
          mortgageInsuranceMonthly: footprint.mortgageInsuranceMonthly,
        }
      : resolveFinancementValues(activeDraft);

  const propertyValue = parseCurrency(draft.propertyValue) || footprint.propertyValue;
  const surface = parseNumber(draft.propertySurface) || footprint.propertySurface;
  const contribA =
    (draft.contributionA ?? "").trim() !== ""
      ? parseCurrency(draft.contributionA ?? "")
      : footprint.contributionA;
  const contribB =
    (draft.contributionB ?? "").trim() !== ""
      ? parseCurrency(draft.contributionB ?? "")
      : footprint.contributionB;
  const purchasePrice = derivePurchasePrice(draft, footprint, resolved);

  const hasLoan =
    resolved.mortgageRemaining > 0 ||
    (resolved.initialMortgagePrincipal > 0 && activeDraft.financementNoCredit !== "1");

  const crd = resolved.mortgageRemaining;
  const monthly = resolved.monthlyMortgagePayment;
  const years = resolved.mortgageRemainingYears;
  const noCredit = activeDraft.financementNoCredit === "1";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.normal, ease: ease.out }}
      className="rounded-xl border border-slate-200/80 bg-white/50 px-4 py-4 text-left"
    >
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
        Bilan du bien
      </p>
      <dl className="space-y-2.5">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-[11px] text-slate-500">Valeur actuelle</dt>
          <dd className="text-sm font-medium tabular-nums text-slate-900">
            {formatEuro(propertyValue)}
            {surface > 0 && (
              <span className="ml-1 text-xs font-normal text-slate-400">
                · {surface} m²
              </span>
            )}
          </dd>
        </div>

        {(contribA > 0 || contribB > 0) && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[11px] text-slate-500">Apports à l&apos;achat</dt>
            <dd className="text-sm font-medium tabular-nums text-slate-900">
              {formatEuro(contribA + contribB)}
              <span className="ml-1 text-xs font-normal text-slate-400">
                (vous {formatEuro(contribA)} · autre {formatEuro(contribB)})
              </span>
            </dd>
          </div>
        )}

        {purchasePrice != null && purchasePrice > 0 && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[11px] text-slate-500">Prix d&apos;achat estimé</dt>
            <dd className="text-sm font-medium tabular-nums text-slate-900">
              {formatEuro(purchasePrice)}
            </dd>
          </div>
        )}

        {noCredit && (
          <p className="text-xs text-slate-500">Aucun crédit immobilier en cours.</p>
        )}

        {hasLoan && crd > 0 && (
          <>
            <div className="my-2 border-t border-slate-200/60" />
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Crédit aujourd&apos;hui
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <dt className="text-[11px] text-slate-500">CRD</dt>
                <dd className="mt-0.5 text-sm font-medium tabular-nums text-slate-900">
                  {formatEuro(crd)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">Mensualité</dt>
                <dd className="mt-0.5 text-sm font-medium tabular-nums text-slate-900">
                  {formatEuro(monthly)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">Reste</dt>
                <dd className="mt-0.5 text-sm font-medium tabular-nums text-slate-900">
                  {years} ans
                </dd>
              </div>
            </div>
          </>
        )}

        {hasLoan && crd === 0 && resolved.initialMortgagePrincipal > 0 && (
          <p className="text-xs text-slate-500">Crédit remboursé selon vos paramètres.</p>
        )}
      </dl>
    </motion.div>
  );
}
