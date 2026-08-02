"use client";

import { motion, useReducedMotion } from "framer-motion";
import { duration, ease } from "@/lib/motion";
import { EmpreinteFormRow, EmpreinteStepNav } from "./empreinte-field";
import { EMPREINTE_SCREEN_INTENTS, type EmpreinteDraft } from "./empreinte-screens";

export function EmpreinteRevenusScreen({
  draft,
  onDraftChange,
  onContinue,
  canContinue,
  validationHint,
  onBack,
  progress,
}: {
  draft: EmpreinteDraft;
  onDraftChange: (patch: Partial<EmpreinteDraft>) => void;
  canContinue: boolean;
  onContinue: () => void;
  validationHint?: string;
  onBack?: () => void;
  progress?: React.ReactNode;
}) {
  const reduced = useReducedMotion();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canContinue && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      onContinue();
    }
  };

  return (
    <motion.div
      key="revenus"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
      transition={{ duration: duration.slow, ease: ease.out }}
      className="mx-auto flex w-full max-w-md flex-col items-center text-center"
      onKeyDown={handleKeyDown}
    >
      {progress}

      <h1 className="mb-3 text-xl font-medium tracking-tight text-slate-800 md:text-2xl">
        Les revenus
      </h1>
      <p className="mb-10 max-w-sm text-sm text-slate-500">
        {EMPREINTE_SCREEN_INTENTS.revenus}
      </p>

      <div className="flex w-full flex-col gap-8 text-left">
        <EmpreinteFormRow
          id="incomeA"
          label="Vos revenus nets, par mois"
          type="currency"
          value={draft.incomeA}
          onChange={(v) => onDraftChange({ incomeA: v })}
          placeholder="3 500"
          hint="Net avant impôt (prélèvement à la source)."
          autoFocus
        />
        <EmpreinteFormRow
          id="incomeB"
          label="Revenus de l'autre, par mois"
          type="currency"
          value={draft.incomeB}
          onChange={(v) => onDraftChange({ incomeB: v })}
          placeholder="2 800"
          hint="Net avant impôt (prélèvement à la source)."
        />
      </div>

      {!canContinue && validationHint && (
        <p className="mt-4 max-w-sm text-xs leading-relaxed text-slate-400">{validationHint}</p>
      )}

      <EmpreinteStepNav
        onBack={onBack}
        onContinue={() => onContinue()}
        canContinue={canContinue}
        continueLabel="Voir les portes"
        className="mt-10 sm:mt-12"
      />
    </motion.div>
  );
}
