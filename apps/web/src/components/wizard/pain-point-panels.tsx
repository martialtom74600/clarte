"use client";

import { formatEuro } from "@/lib/utils";
import type {
  CashflowResult,
  ChildSupportResult,
  PatrimonyImbalance,
  ResolutionComparison,
} from "@separation/engine";

interface CashflowPanelProps {
  cashflow: CashflowResult;
}

export function CashflowPanel({ cashflow }: CashflowPanelProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="font-semibold text-slate-900">Budget mensuel post-séparation</h3>
      <p className="mt-1 text-sm text-slate-600">
        Anticipez le choc du quotidien : loyers, charges, pension alimentaire.
      </p>
      {cashflow.warning && (
        <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
          {cashflow.warning}
        </div>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {(["personA", "personB"] as const).map((key, i) => {
          const p = cashflow[key];
          const label = i === 0 ? "Personne A" : "Personne B";
          const tight = p.remaining.amount < 500;
          return (
            <div
              key={key}
              className={`rounded-xl p-4 ${tight ? "bg-rose-50 border border-rose-200" : "bg-slate-50"}`}
            >
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {formatEuro(p.remaining.amount)}
                <span className="text-sm font-normal text-slate-500"> /mois restants</span>
              </p>
              <ul className="mt-3 space-y-1 text-xs text-slate-600">
                <li>Revenus : {formatEuro(p.income.amount)}</li>
                <li>{p.housingLabel} : −{formatEuro(p.housing.amount)}</li>
                {p.childSupport.amount > 0 && (
                  <li>Pension alimentaire : −{formatEuro(p.childSupport.amount)}</li>
                )}
                <li>Charges estimées : −{formatEuro(p.otherCosts.amount)}</li>
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Foyer avant : {formatEuro(cashflow.householdBefore.amount)}/mois → après :{" "}
        {formatEuro(cashflow.householdAfter.amount)}/mois
        {cashflow.lifestyleDropPercent > 0 && ` (−${cashflow.lifestyleDropPercent}%)`}
      </p>
    </div>
  );
}

interface ImbalanceAlertProps {
  imbalance: PatrimonyImbalance;
}

export function ImbalanceAlert({ imbalance }: ImbalanceAlertProps) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        imbalance.suggestsCompensatoryAllowance
          ? "bg-rose-50 border-rose-200 text-rose-900"
          : "bg-amber-50 border-amber-200 text-amber-900"
      }`}
    >
      <p className="font-medium">
        Déséquilibre patrimonial ({imbalance.ratio}:1) — Personne {imbalance.disadvantaged} désavantagée
      </p>
      <p className="mt-1">{imbalance.message}</p>
      <p className="mt-2 text-xs opacity-80">
        Écart estimé : {formatEuro(imbalance.gapAmount.amount)} — Les chiffres objectivent la discussion, sans jugement moral.
      </p>
    </div>
  );
}

interface ChildSupportPanelProps {
  support: ChildSupportResult;
}

export function ChildSupportPanel({ support }: ChildSupportPanelProps) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50 p-6">
      <h3 className="font-semibold text-brand-900">Pension alimentaire indicative</h3>
      <p className="mt-2 text-3xl font-bold text-brand-800">
        {formatEuro(support.monthlyAmount.amount)}/mois
      </p>
      <p className="mt-1 text-sm text-brand-700">
        Versée par {support.payerId} ({support.percentageApplied.toFixed(1)}% du revenu)
      </p>
      <p className="mt-3 text-xs text-brand-600">{support.basis}</p>
      <p className="mt-2 text-xs text-slate-500">{support.disclaimer}</p>
    </div>
  );
}

interface ResolutionCompareProps {
  comparison: ResolutionComparison;
  onChooseAmiable?: () => void;
}

export function ResolutionCompare({ comparison, onChooseAmiable }: ResolutionCompareProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">Amiable vs contentieux</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5">
          <p className="font-semibold text-emerald-900">{comparison.amiable.label}</p>
          <p className="mt-2 text-2xl font-bold text-emerald-800">
            ~{formatEuro(comparison.amiable.estimatedCost.amount)}
          </p>
          <p className="text-sm text-emerald-700">
            Délai estimé : {comparison.amiable.estimatedMonths} mois
          </p>
          <p className="mt-2 text-xs text-emerald-600">{comparison.amiable.description}</p>
          {onChooseAmiable && (
            <button
              type="button"
              onClick={onChooseAmiable}
              className="mt-4 w-full rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Régler à l&apos;amiable
            </button>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 opacity-90">
          <p className="font-semibold text-slate-700">{comparison.contentieux.label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">
            ~{formatEuro(comparison.contentieux.estimatedCost.amount)}
          </p>
          <p className="text-sm text-slate-600">
            Délai moyen : {comparison.contentieux.estimatedMonths} mois
          </p>
          <p className="mt-2 text-xs text-slate-500">{comparison.contentieux.description}</p>
        </div>
      </div>
      <p className="text-sm text-brand-700 font-medium">
        Économie estimée à l&apos;amiable : {formatEuro(comparison.savings.amount)} et{" "}
        {comparison.savingsMonths} mois gagnés
      </p>
    </div>
  );
}

interface MediationLinkProps {
  onGenerate: () => void;
  link?: string;
}

export function MediationLinkPanel({ onGenerate, link }: MediationLinkProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="font-semibold text-slate-900">Mode médiation asynchrone</h3>
      <p className="mt-2 text-sm text-slate-600">
        Envoyez un lien à l&apos;autre partie. Chacun remplit sa version séparément — l&apos;outil
        ne montre que les écarts, sans émotion ni confrontation.
      </p>
      {!link ? (
        <button
          type="button"
          onClick={onGenerate}
          className="mt-4 rounded-full bg-brand-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Générer un lien de médiation
        </button>
      ) : (
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <p className="text-xs text-slate-500 mb-1">Lien à partager</p>
          <code className="text-sm text-brand-700 break-all">{link}</code>
        </div>
      )}
    </div>
  );
}

interface EmotionalSandboxBannerProps {
  discreteMode?: boolean;
}

export function EmotionalSandboxBanner({ discreteMode }: EmotionalSandboxBannerProps) {
  return (
    <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
      <p>
        <span className="font-medium text-slate-700">Approche factuelle.</span> Cet outil ne juge
        personne — il traduit votre situation en chiffres neutres pour faciliter des décisions
        rationnelles.
        {discreteMode && " Mode discret activé."}
      </p>
    </div>
  );
}
