"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Scale, Users } from "lucide-react";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { EmpreinteFormRow, EmpreinteStepNav } from "./empreinte-field";
import { FinancementModeOption } from "./empreinte-financement-card";
import type { EmpreinteDraft } from "./empreinte-screens";
import {
  LEGAL_STATUS_OPTIONS,
  OWNERSHIP_PRESETS,
  parseSharePercent,
} from "./empreinte-screens";
import type { RelationshipStatus } from "@separation/schemas";

function activePreset(draft: EmpreinteDraft): string | null {
  const shareA = parseSharePercent(draft.ownershipShareA);
  const shareB = parseSharePercent(draft.ownershipShareB);
  const match = OWNERSHIP_PRESETS.find((p) => p.shareA === shareA && p.shareB === shareB);
  return match?.label ?? null;
}

export function EmpreinteCadreJuridiqueScreen({
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
  const [showCustomShares, setShowCustomShares] = useState(false);
  const presetLabel = useMemo(() => activePreset(draft), [draft]);
  const isCustomShare = showCustomShares || presetLabel === null;

  const selectStatus = (status: RelationshipStatus) => {
    onDraftChange({ legalStatus: status });
  };

  const selectPreset = (shareA: number, shareB: number) => {
    setShowCustomShares(false);
    onDraftChange({
      ownershipShareA: String(shareA),
      ownershipShareB: String(shareB),
    });
  };

  const updateShareA = (raw: string) => {
    const shareA = Math.min(99, Math.max(1, parseSharePercent(raw)));
    onDraftChange({
      ownershipShareA: String(shareA),
      ownershipShareB: String(100 - shareA),
    });
  };

  const updateShareB = (raw: string) => {
    const shareB = Math.min(99, Math.max(1, parseSharePercent(raw)));
    onDraftChange({
      ownershipShareB: String(shareB),
      ownershipShareA: String(100 - shareB),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canContinue && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      onContinue();
    }
  };

  return (
    <motion.div
      key="cadre_juridique"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
      transition={{ duration: duration.slow, ease: ease.out }}
      className="mx-auto flex w-full max-w-md flex-col items-center text-center"
      onKeyDown={handleKeyDown}
    >
      {progress}

      <h1 className="mb-3 text-xl font-medium tracking-tight text-slate-800 md:text-2xl">
        Le cadre juridique
      </h1>
      <p className="mb-10 max-w-sm text-sm text-slate-500">
        Votre statut et vos parts sur l&apos;acte de vente — essentiels pour calculer la soulte
        en cas de rachat.
      </p>

      <div className="mb-10 w-full text-left">
        <p className="mb-4 text-sm font-medium text-slate-500">Statut de votre couple</p>
        <div className="flex flex-col">
          {LEGAL_STATUS_OPTIONS.map((option) => (
            <FinancementModeOption
              key={option.value}
              selected={draft.legalStatus === option.value}
              onSelect={() => selectStatus(option.value)}
              icon={Scale}
              title={option.label}
            />
          ))}
        </div>
      </div>

      <div className="w-full text-left">
        <p className="mb-4 text-sm font-medium text-slate-500">Répartition de la propriété</p>
        <p className="mb-5 text-xs text-slate-400">
          Regardez votre acte de vente notarié — indivision ou quote-parts indiquées.
        </p>

        <div className="mb-6 flex flex-wrap gap-2">
          {OWNERSHIP_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => selectPreset(preset.shareA, preset.shareB)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30",
                presetLabel === preset.label
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white/60 text-slate-600 hover:border-slate-300 hover:text-slate-800"
              )}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowCustomShares(true)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30",
              isCustomShare
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white/60 text-slate-600 hover:border-slate-300 hover:text-slate-800"
            )}
          >
            Autre
          </button>
        </div>

        {isCustomShare && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration.normal, ease: ease.out }}
            className="mb-2 grid grid-cols-2 gap-6"
          >
            <EmpreinteFormRow
              id="ownershipShareA"
              label="Votre part"
              type="number"
              value={draft.ownershipShareA}
              onChange={updateShareA}
              placeholder="60"
              suffix="%"
              autoFocus
            />
            <EmpreinteFormRow
              id="ownershipShareB"
              label="Part de l'autre"
              type="number"
              value={draft.ownershipShareB}
              onChange={updateShareB}
              placeholder="40"
              suffix="%"
            />
          </motion.div>
        )}

        {!isCustomShare && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
            <Users className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span>
              Vous <strong className="font-medium text-slate-800">{draft.ownershipShareA} %</strong>
              {" · "}
              Autre{" "}
              <strong className="font-medium text-slate-800">{draft.ownershipShareB} %</strong>
            </span>
          </div>
        )}
      </div>

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
