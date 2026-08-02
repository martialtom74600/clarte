"use client";

import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Home, History } from "lucide-react";
import { duration, ease, spring } from "@/lib/motion";
import {
  EmpreinteFormRow,
  EmpreinteStepNav,
} from "./empreinte-field";
import { FinancementModeOption } from "./empreinte-financement-card";
import type { EmpreinteDraft } from "./empreinte-screens";
import {
  inferFinancementUiMode,
  isFinancementValidForMode,
  type FinancementUiMode,
} from "./empreinte-screens";
import {
  getFinancementEstimateMissingFields,
  normalizeMortgageStartDate,
  sanitizeMortgageStartDate,
} from "./empreinte-amortization";
import { cn } from "@/lib/utils";
import type { FootprintState } from "@/lib/separation/separation-types";
import { EmpreinteRecap } from "./empreinte-recap";

type FinancementMode = FinancementUiMode;

type EstimateFormState = Pick<
  EmpreinteDraft,
  | "initialMortgagePrincipal"
  | "mortgageStartDate"
  | "initialMortgageDurationYears"
  | "initialMortgageRate"
  | "mortgageInsuranceMonthly"
>;

function estimateFormFromDraft(draft: EmpreinteDraft): EstimateFormState {
  return {
    initialMortgagePrincipal: draft.initialMortgagePrincipal ?? "",
    mortgageStartDate: draft.mortgageStartDate ?? "",
    initialMortgageDurationYears: draft.initialMortgageDurationYears ?? "",
    initialMortgageRate: draft.initialMortgageRate ?? "",
    mortgageInsuranceMonthly: draft.mortgageInsuranceMonthly ?? "",
  };
}

function draftPatchForMode(mode: FinancementMode, draft: EmpreinteDraft): Partial<EmpreinteDraft> {
  if (mode === "no_credit") {
    // Ne pas effacer les champs d'estimation : resolveFinancementValues les ignore,
    // et l'utilisateur peut revenir à « Estimation » sans retaper.
    return {
      financementNoCredit: "1",
      mortgageRemaining: "0",
      monthlyMortgagePayment: "",
      mortgageRemainingYears: "",
    };
  }
  return {
    financementNoCredit: "",
    mortgageRemaining: draft.mortgageRemaining === "0" ? "" : draft.mortgageRemaining,
  };
}

function buildMergedDraft(
  draft: EmpreinteDraft,
  mode: FinancementMode,
  estimateForm: EstimateFormState
): EmpreinteDraft {
  const base = { ...draft, ...draftPatchForMode(mode, draft) };
  if (mode === "estimate") {
    return { ...base, ...estimateForm };
  }
  return base;
}

const MODES: { id: FinancementMode; icon: typeof Home; title: string }[] = [
  { id: "no_credit", icon: Home, title: "Je n'ai plus de crédit immobilier" },
  {
    id: "estimate",
    icon: History,
    title: "Je me souviens de mon emprunt — on estime le reste à payer.",
  },
];

const panelMotion = (reduced: boolean) =>
  reduced
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: duration.fast },
      }
    : {
        initial: { opacity: 0, height: 0 },
        animate: { opacity: 1, height: "auto" },
        exit: { opacity: 0, height: 0 },
        transition: { duration: duration.normal, ease: ease.out },
      };

export function EmpreinteFinancementScreen({
  draft,
  footprint,
  onDraftChange,
  onContinue,
  onBack,
  progress,
}: {
  draft: EmpreinteDraft;
  footprint: FootprintState;
  onDraftChange: (patch: Partial<EmpreinteDraft>) => void;
  onContinue: (merged: EmpreinteDraft, mode: FinancementUiMode) => boolean;
  onBack?: () => void;
  progress?: React.ReactNode;
  /** @deprecated Validation locale — conservé pour compatibilité shell. */
  canContinue?: boolean;
}) {
  const reduced = useReducedMotion();
  const [activeMode, setActiveMode] = useState<FinancementMode>(() => inferFinancementUiMode(draft));
  const [estimateForm, setEstimateForm] = useState<EstimateFormState>(() => estimateFormFromDraft(draft));
  const [continueError, setContinueError] = useState<string | null>(null);

  const mergedPreview = useMemo(
    () => buildMergedDraft(draft, activeMode, estimateForm),
    [draft, activeMode, estimateForm]
  );

  const canContinueLocal = useMemo(() => {
    if (activeMode === "no_credit") return true;
    return isFinancementValidForMode(mergedPreview, activeMode);
  }, [mergedPreview, activeMode]);

  useLayoutEffect(() => {
    onDraftChange(draftPatchForMode(activeMode, draft));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectMode = (mode: FinancementMode) => {
    setContinueError(null);
    setActiveMode(mode);
    if (mode === "estimate") {
      // Réinjecte le formulaire local au draft parent (survit à Retour).
      onDraftChange({ ...draftPatchForMode(mode, draft), ...estimateForm });
    } else {
      onDraftChange(draftPatchForMode(mode, draft));
    }
  };

  const updateEstimateField = useCallback(
    <K extends keyof EstimateFormState>(field: K, value: EstimateFormState[K]) => {
      setContinueError(null);
      setEstimateForm((prev) => {
        const next = { ...prev, [field]: value };
        // Persiste dans le draft parent pour survivre à Retour / remount.
        onDraftChange(next);
        return next;
      });
    },
    [onDraftChange]
  );

  const handleContinue = () => {
    setContinueError(null);
    const normalizedDate = normalizeMortgageStartDate(estimateForm.mortgageStartDate);
    const estimatePayload =
      activeMode === "estimate"
        ? { ...estimateForm, mortgageStartDate: normalizedDate }
        : estimateForm;
    if (activeMode === "estimate" && normalizedDate !== estimateForm.mortgageStartDate) {
      setEstimateForm((prev) => ({ ...prev, mortgageStartDate: normalizedDate }));
    }
    const merged = buildMergedDraft(draft, activeMode, estimatePayload);

    if (activeMode === "estimate") {
      const missing = getFinancementEstimateMissingFields(merged);
      if (missing.length > 0) {
        setContinueError(`Il manque : ${missing.join(", ")}.`);
        return;
      }
    }

    if (!isFinancementValidForMode(merged, activeMode)) {
      setContinueError(
        "Impossible de calculer l'emprunt avec ces valeurs. Vérifiez la date (MM/AAAA) et le taux."
      );
      return;
    }

    onDraftChange({ ...draftPatchForMode(activeMode, draft), ...estimatePayload });
    const ok = onContinue(merged, activeMode);
    if (!ok) {
      setContinueError("Impossible de passer à l'étape suivante. Réessayez.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      handleContinue();
    }
  };

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

      <h1 className="mb-8 text-xl font-medium tracking-tight text-slate-800 md:text-2xl">
        Le financement
      </h1>

      <div className="mb-6 w-full text-left">
        {MODES.map((mode) => (
          <FinancementModeOption
            key={mode.id}
            selected={activeMode === mode.id}
            onSelect={() => selectMode(mode.id)}
            icon={mode.icon}
            title={mode.title}
          />
        ))}
      </div>

      <motion.div layout className="w-full overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {activeMode === "no_credit" && (
            <motion.div
              key="no_credit"
              {...panelMotion(!!reduced)}
              className="overflow-hidden"
            >
              <p className="mb-2 w-full py-1 text-sm text-slate-500">
                Parfait — le bilan de votre bien s&apos;affiche ci-dessous.
              </p>
            </motion.div>
          )}

          {activeMode === "estimate" && (
            <motion.div
              key="estimate"
              {...panelMotion(!!reduced)}
              className="overflow-hidden"
            >
              <div className="mb-2 flex w-full flex-col gap-6 pb-1 text-left">
                <EmpreinteFormRow
                  id="initialMortgagePrincipal"
                  label="Capital emprunté au départ"
                  type="currency"
                  value={estimateForm.initialMortgagePrincipal}
                  onChange={(v) => updateEstimateField("initialMortgagePrincipal", v)}
                  placeholder="350 000"
                  hint="Montant du prêt, pas le prix d'achat si vous aviez un apport."
                  autoFocus
                />

                <div>
                  <label
                    htmlFor="mortgageStartDate"
                    className="mb-2 block text-sm font-medium text-slate-500"
                  >
                    Date de souscription
                  </label>
                  <input
                    id="mortgageStartDate"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={estimateForm.mortgageStartDate}
                    placeholder="MM/AAAA"
                    onChange={(e) =>
                      updateEstimateField(
                        "mortgageStartDate",
                        sanitizeMortgageStartDate(e.target.value)
                      )
                    }
                    onBlur={(e) =>
                      updateEstimateField(
                        "mortgageStartDate",
                        normalizeMortgageStartDate(e.target.value)
                      )
                    }
                    className={cn(
                      "w-full border-0 border-b border-slate-300/80 bg-transparent pb-2.5 text-left",
                      "text-2xl font-light tracking-tight text-slate-900 placeholder:text-slate-300",
                      "outline-none transition-colors focus:border-brand-500/60 md:text-3xl"
                    )}
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Mois et année du 1er prélèvement.
                  </p>
                </div>

                <EmpreinteFormRow
                  id="initialMortgageDurationYears"
                  label="Durée initiale du prêt"
                  type="number"
                  value={estimateForm.initialMortgageDurationYears}
                  onChange={(v) => updateEstimateField("initialMortgageDurationYears", v)}
                  placeholder="25"
                  suffix="ans"
                />

                <EmpreinteFormRow
                  id="initialMortgageRate"
                  label="Taux d'intérêt (hors assurance)"
                  type="rate"
                  value={estimateForm.initialMortgageRate}
                  onChange={(v) => updateEstimateField("initialMortgageRate", v)}
                  placeholder="1,2"
                  suffix="%"
                  hint="Taux nominal à la signature. Crucial pour calculer vos économies face aux taux actuels."
                />

                <EmpreinteFormRow
                  id="mortgageInsuranceMonthly"
                  label="Coût de l'assurance (€/mois)"
                  type="currency"
                  value={estimateForm.mortgageInsuranceMonthly}
                  onChange={(v) => updateEstimateField("mortgageInsuranceMonthly", v)}
                  placeholder="85"
                  hint="Laissez vide si inconnu, nous appliquerons une moyenne bancaire."
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {canContinueLocal && (
        <motion.div
          layout
          className="mt-8 w-full"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.normal, ease: ease.out }}
        >
          <EmpreinteRecap
            draft={draft}
            footprint={footprint}
            financementDraft={mergedPreview}
          />
        </motion.div>
      )}

      <motion.div layout transition={spring.soft}>
        {!canContinueLocal && activeMode === "estimate" && !continueError && (
          <p className="mb-3 max-w-sm text-xs leading-relaxed text-slate-400">
            Complétez le capital, la date (MM/AAAA), la durée et le taux — ou choisissez « Je
            n&apos;ai plus de crédit immobilier ».
          </p>
        )}
        {continueError && (
          <p className="mb-3 max-w-sm text-xs leading-relaxed text-red-500">{continueError}</p>
        )}
        <EmpreinteStepNav
          onBack={onBack}
          onContinue={() => handleContinue()}
          continueAlwaysEnabled
          className="mt-10 sm:mt-12"
        />
      </motion.div>
    </motion.div>
  );
}
