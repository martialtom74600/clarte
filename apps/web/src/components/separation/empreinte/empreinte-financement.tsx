"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { duration, ease } from "@/lib/motion";
import {
  EmpreinteContinueButton,
  EmpreinteFormRow,
  parseCurrency,
} from "./empreinte-field";
import type { EmpreinteDraft } from "./empreinte-screens";
import {
  amortizationToDraftFields,
  canComputeAmortization,
  computeFinancementFromAmortization,
  sanitizeMortgageStartDate,
} from "./empreinte-amortization";

type OverrideField = "crd" | "monthly" | "years";

function RateRow({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <EmpreinteFormRow
      id={id}
      label={label}
      type="number"
      value={value}
      onChange={(v) => onChange(v.replace(/[^\d,]/g, "").replace(".", ","))}
      placeholder="1,2"
      suffix="%"
      hint={hint}
    />
  );
}

export function EmpreinteFinancementScreen({
  draft,
  onDraftChange,
  canContinue,
  onContinue,
  progress,
}: {
  draft: EmpreinteDraft;
  onDraftChange: (patch: Partial<EmpreinteDraft>) => void;
  canContinue: boolean;
  onContinue: () => void;
  progress?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const manualMode = draft.financementManual === "1";
  const [overrides, setOverrides] = useState<Set<OverrideField>>(new Set());
  const lastSyncedKeyRef = useRef("");

  const amortization = useMemo(() => {
    if (manualMode || !canComputeAmortization(draft)) return null;
    return computeFinancementFromAmortization(draft);
  }, [manualMode, draft]);

  const computedFields = useMemo(
    () => (amortization ? amortizationToDraftFields(amortization) : null),
    [amortization]
  );

  const crdOverridden = overrides.has("crd");
  const monthlyOverridden = overrides.has("monthly");
  const yearsOverridden = overrides.has("years");

  const displayCrd = crdOverridden
    ? draft.mortgageRemaining
    : (computedFields?.mortgageRemaining ?? draft.mortgageRemaining);
  const displayMonthly = monthlyOverridden
    ? draft.monthlyMortgagePayment
    : (computedFields?.monthlyMortgagePayment ?? draft.monthlyMortgagePayment);
  const displayYears = yearsOverridden
    ? draft.mortgageRemainingYears
    : (computedFields?.mortgageRemainingYears ?? draft.mortgageRemainingYears);

  // Sync computed → draft une seule fois par changement d'inputs (évite boucle infinie).
  useEffect(() => {
    if (manualMode || !amortization || !computedFields) {
      lastSyncedKeyRef.current = "";
      return;
    }

    const syncKey = [
      computedFields.mortgageRemaining,
      computedFields.monthlyMortgagePayment,
      computedFields.mortgageRemainingYears,
      crdOverridden,
      monthlyOverridden,
      yearsOverridden,
    ].join("|");

    if (syncKey === lastSyncedKeyRef.current) return;
    lastSyncedKeyRef.current = syncKey;

    const patch: Partial<EmpreinteDraft> = {};
    if (!crdOverridden) patch.mortgageRemaining = computedFields.mortgageRemaining;
    if (!monthlyOverridden) patch.monthlyMortgagePayment = computedFields.monthlyMortgagePayment;
    if (!yearsOverridden) patch.mortgageRemainingYears = computedFields.mortgageRemainingYears;

    if (Object.keys(patch).length > 0) onDraftChange(patch);
  }, [
    amortization,
    computedFields,
    manualMode,
    crdOverridden,
    monthlyOverridden,
    yearsOverridden,
    onDraftChange,
  ]);

  const setManualMode = (manual: boolean) => {
    onDraftChange({ financementManual: manual ? "1" : "" });
    if (!manual) setOverrides(new Set());
    lastSyncedKeyRef.current = "";
  };

  const updateField = (field: keyof EmpreinteDraft, value: string) => {
    onDraftChange({ [field]: value });
  };

  const updateComputedField = (
    field: OverrideField,
    draftField: keyof EmpreinteDraft,
    value: string
  ) => {
    setOverrides((prev) => new Set(prev).add(field));
    lastSyncedKeyRef.current = "";
    onDraftChange({ [draftField]: value });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canContinue && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      onContinue();
    }
  };

  const showEstimates = !manualMode && amortization != null && amortization.remainingBalance > 0;

  return (
    <motion.div
      key="financement"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
      transition={{ duration: duration.slow, ease: ease.out }}
      className="mx-auto flex w-full max-w-md flex-col items-center text-center"
      onKeyDown={handleKeyDown}
    >
      {progress}
      <h1 className="mb-6 text-xl font-medium tracking-tight text-slate-800 md:text-2xl">
        Le financement
      </h1>

      {!manualMode && (
        <div className="mb-8 w-full text-left">
          <p className="mb-6 text-center text-sm text-slate-500">
            Je me souviens de mon emprunt — on estime le reste à payer.
          </p>
          <div className="flex flex-col gap-8">
            <EmpreinteFormRow
              id="initialMortgagePrincipal"
              label="Capital emprunté au départ"
              type="currency"
              value={draft.initialMortgagePrincipal}
              onChange={(v) => updateField("initialMortgagePrincipal", v)}
              placeholder="350 000"
              hint="Montant du prêt, pas le prix d'achat si vous aviez un apport."
              autoFocus
            />
            <div>
              <label
                htmlFor="mortgageStartDate"
                className="mb-2 block text-left text-sm font-medium text-slate-600"
              >
                Date de souscription
              </label>
              <input
                id="mortgageStartDate"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={draft.mortgageStartDate}
                placeholder="MM/AAAA"
                onChange={(e) =>
                  updateField("mortgageStartDate", sanitizeMortgageStartDate(e.target.value))
                }
                className={cn(
                  "w-full border-0 border-b border-slate-300/80 bg-transparent pb-2 text-left",
                  "text-2xl font-light tracking-tight text-slate-900 placeholder:text-slate-300",
                  "outline-none transition-colors focus:border-brand-500/60"
                )}
              />
              <p className="mt-2 text-xs text-slate-400">Mois et année du 1er prélèvement.</p>
            </div>
            <EmpreinteFormRow
              id="initialMortgageDurationYears"
              label="Durée initiale du prêt"
              type="number"
              value={draft.initialMortgageDurationYears}
              onChange={(v) => updateField("initialMortgageDurationYears", v)}
              placeholder="25"
              suffix="ans"
            />
            <RateRow
              id="initialMortgageRate"
              label="Taux d'intérêt (hors assurance)"
              value={draft.initialMortgageRate}
              onChange={(v) => updateField("initialMortgageRate", v)}
              hint="Taux nominal à la signature. Crucial pour calculer vos économies face aux taux actuels."
            />
            <EmpreinteFormRow
              id="mortgageInsuranceMonthly"
              label="Coût de l'assurance (€/mois)"
              type="currency"
              value={draft.mortgageInsuranceMonthly}
              onChange={(v) => updateField("mortgageInsuranceMonthly", v)}
              placeholder="85"
              hint="Laissez vide si inconnu, nous appliquerons une moyenne bancaire."
            />
          </div>
        </div>
      )}

      {manualMode && (
        <div className="flex w-full flex-col gap-8 text-left">
          <p className="text-center text-sm text-slate-500">
            Saisie manuelle — relevé bancaire ou remboursement anticipé.
          </p>
          <EmpreinteFormRow
            id="mortgageRemaining"
            label="Capital restant dû"
            type="currency"
            value={draft.mortgageRemaining}
            onChange={(v) => updateField("mortgageRemaining", v)}
            placeholder="200 000"
            hint="Indiquez 0 s'il n'y a plus de crédit."
            autoFocus
          />
          {parseCurrency(draft.mortgageRemaining) > 0 && (
            <>
              <EmpreinteFormRow
                id="monthlyMortgagePayment"
                label="Mensualité actuelle (assurance incluse)"
                type="currency"
                value={draft.monthlyMortgagePayment}
                onChange={(v) => updateField("monthlyMortgagePayment", v)}
                placeholder="1 200"
              />
              <EmpreinteFormRow
                id="mortgageRemainingYears"
                label="Durée restante"
                type="number"
                value={draft.mortgageRemainingYears}
                onChange={(v) => updateField("mortgageRemainingYears", v)}
                placeholder="15"
                suffix="ans"
              />
            </>
          )}
        </div>
      )}

      {showEstimates && (
        <div className="mb-4 w-full rounded-2xl border border-slate-200/80 bg-white/60 px-5 py-5 text-left shadow-sm">
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-400">
            Estimation aujourd&apos;hui
          </p>
          <div className="flex flex-col gap-6">
            <EmpreinteFormRow
              id="est-crd"
              label="Capital restant dû"
              type="currency"
              value={displayCrd}
              onChange={(v) => updateComputedField("crd", "mortgageRemaining", v)}
              hint={
                crdOverridden
                  ? "Valeur ajustée manuellement."
                  : "Modifiable si remboursement anticipé."
              }
            />
            <EmpreinteFormRow
              id="est-monthly"
              label="Mensualité (capital + intérêts + assurance)"
              type="currency"
              value={displayMonthly}
              onChange={(v) => updateComputedField("monthly", "monthlyMortgagePayment", v)}
            />
            <EmpreinteFormRow
              id="est-years"
              label="Durée restante"
              type="number"
              value={displayYears}
              onChange={(v) => updateComputedField("years", "mortgageRemainingYears", v)}
              suffix="ans"
            />
          </div>
          {amortization && (
            <p className="mt-4 text-xs text-slate-400">
              Hors remboursements anticipés · assurance{" "}
              {parseCurrency(draft.mortgageInsuranceMonthly) > 0
                ? `${parseCurrency(draft.mortgageInsuranceMonthly).toLocaleString("fr-FR")} €/mois`
                : "moyenne bancaire appliquée"}
            </p>
          )}
        </div>
      )}

      {!manualMode && canComputeAmortization(draft) && amortization?.remainingBalance === 0 && (
        <p className="mb-4 text-sm text-slate-500">
          D&apos;après vos paramètres, le crédit semble remboursé.
        </p>
      )}

      <button
        type="button"
        onClick={() => setManualMode(!manualMode)}
        className="mb-2 text-xs text-slate-400 underline-offset-2 transition-colors hover:text-slate-600 hover:underline"
      >
        {manualMode
          ? "← Revenir à l'estimation automatique"
          : "Saisir manuellement CRD et mensualité"}
      </button>

      {!manualMode && (
        <button
          type="button"
          onClick={() => {
            lastSyncedKeyRef.current = "";
            onDraftChange({
              mortgageRemaining: "0",
              monthlyMortgagePayment: "",
              mortgageRemainingYears: "",
            });
          }}
          className="mb-4 text-xs text-slate-400 underline-offset-2 transition-colors hover:text-slate-600 hover:underline"
        >
          Je n&apos;ai plus de crédit
        </button>
      )}

      <EmpreinteContinueButton onClick={onContinue} disabled={!canContinue} />
    </motion.div>
  );
}
