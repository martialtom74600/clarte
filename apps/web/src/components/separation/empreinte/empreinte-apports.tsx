"use client";

import { motion, useReducedMotion } from "framer-motion";
import { duration, ease } from "@/lib/motion";
import { EmpreinteFormRow, EmpreinteStepNav } from "./empreinte-field";
import type { EmpreinteDraft } from "./empreinte-screens";

export function EmpreinteApportsScreen({
  draft,
  onDraftChange,
  onContinue,
  canContinue,
  onBack,
  progress,
}: {
  draft: EmpreinteDraft;
  onDraftChange: (patch: Partial<EmpreinteDraft>) => void;
  canContinue: boolean;
  onContinue: () => void;
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
      key="apports"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
      transition={{ duration: duration.slow, ease: ease.out }}
      className="mx-auto flex w-full max-w-md flex-col items-center text-center"
      onKeyDown={handleKeyDown}
    >
      {progress}

      <h1 className="mb-3 text-xl font-medium tracking-tight text-slate-800 md:text-2xl">
        Les apports
      </h1>
      <p className="mb-10 max-w-sm text-sm text-slate-500">
        Combien chacun a investi au moment de l&apos;achat ? Ces montants ajustent la soulte
        (créances d&apos;apport) et aident à reconstituer le prix d&apos;achat.
      </p>

      <div className="flex w-full flex-col gap-8 text-left">
        <EmpreinteFormRow
          id="contributionA"
          label="Votre apport"
          type="currency"
          value={draft.contributionA ?? ""}
          onChange={(v) => onDraftChange({ contributionA: v })}
          placeholder="40 000"
          hint="Laissez vide si aucun ou inconnu."
          autoFocus
        />
        <EmpreinteFormRow
          id="contributionB"
          label="Apport de l'autre"
          type="currency"
          value={draft.contributionB ?? ""}
          onChange={(v) => onDraftChange({ contributionB: v })}
          placeholder="20 000"
          hint="Laissez vide si aucun ou inconnu."
        />
      </div>

      <EmpreinteStepNav
        onBack={onBack}
        onContinue={() => onContinue()}
        canContinue={canContinue}
        className="mt-10 sm:mt-12"
      />
    </motion.div>
  );
}
