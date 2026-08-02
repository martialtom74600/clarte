"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { duration, ease } from "@/lib/motion";
import { formatEuro } from "@/lib/utils";
import { EmpreinteFormRow, EmpreinteStepNav, parseCurrency } from "./empreinte-field";
import {
  EMPREINTE_SCREEN_INTENTS,
  suggestedInitialMortgagePrincipal,
  type EmpreinteDraft,
} from "./empreinte-screens";

export function EmpreinteApportsScreen({
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
  const suggested = useMemo(() => suggestedInitialMortgagePrincipal(draft), [draft]);
  const purchase = parseCurrency(draft.purchasePrice ?? "");
  const apportsTotal =
    parseCurrency(draft.contributionA ?? "") + parseCurrency(draft.contributionB ?? "");

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
        L&apos;achat
      </h1>
      <p className="mb-10 max-w-sm text-sm text-slate-500">
        {EMPREINTE_SCREEN_INTENTS.apports}
      </p>

      <div className="flex w-full flex-col gap-8 text-left">
        <EmpreinteFormRow
          id="purchasePrice"
          label="Prix d'achat à l'origine"
          type="currency"
          value={draft.purchasePrice ?? ""}
          onChange={(v) => onDraftChange({ purchasePrice: v })}
          placeholder="380 000"
          hint="Le prix notarié du bien, hors frais de notaire si possible."
          autoFocus
        />
        <EmpreinteFormRow
          id="contributionA"
          label="Votre apport"
          type="currency"
          value={draft.contributionA ?? ""}
          onChange={(v) => onDraftChange({ contributionA: v })}
          placeholder="40 000"
          hint="Ce que vous avez mis de votre poche. Vide = aucun."
        />
        <EmpreinteFormRow
          id="contributionB"
          label="Apport de l'autre"
          type="currency"
          value={draft.contributionB ?? ""}
          onChange={(v) => onDraftChange({ contributionB: v })}
          placeholder="20 000"
          hint="Vide = aucun ou inconnu."
        />
      </div>

      {purchase > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.normal, ease: ease.out }}
          className="mt-8 w-full rounded-xl border border-slate-200/80 bg-white/50 px-4 py-3 text-left"
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            À l&apos;étape suivante
          </p>
          <p className="mt-1 text-sm text-slate-700">
            Capital emprunté estimé{" "}
            <span className="font-medium tabular-nums text-slate-900">
              {formatEuro(suggested)}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {formatEuro(purchase)}
            {apportsTotal > 0 ? ` − ${formatEuro(apportsTotal)} d'apports` : " − aucun apport"}
            . Ajustable si le prêt incluait les frais.
          </p>
        </motion.div>
      )}

      {!canContinue && validationHint && (
        <p className="mt-4 max-w-sm text-xs leading-relaxed text-slate-400">{validationHint}</p>
      )}

      <EmpreinteStepNav
        onBack={onBack}
        onContinue={() => onContinue()}
        canContinue={canContinue}
        className="mt-10 sm:mt-12"
      />
    </motion.div>
  );
}
