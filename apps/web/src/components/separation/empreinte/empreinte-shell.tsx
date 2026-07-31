"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { clarte } from "@/lib/clarte-design";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useSeparationStore } from "@/store/separation-store";
import { useSeparationHydrated } from "@/lib/separation/use-separation-hydrated";
import type { FootprintField } from "@/lib/separation/separation-types";
import {
  EmpreinteContinueButton,
  EmpreinteField,
  EmpreinteFormRow,
  parseCurrency,
  parseNumber,
} from "./empreinte-field";
import {
  EMPREINTE_SCREENS,
  EMPREINTE_SCREEN_COUNT,
  EMPREINTE_SCREEN_LABELS,
  EMPREINTE_STEP_KEY,
  footprintToDraft,
  hasActiveLoan,
  inferEmpreinteScreen,
  isScreenValid,
  type EmpreinteDraft,
  type EmpreinteScreenId,
} from "./empreinte-screens";

function EmpreinteProgress({ screenId }: { screenId: EmpreinteScreenId }) {
  const index = EMPREINTE_SCREENS.indexOf(screenId);
  const current = index >= 0 ? index : 0;
  const label = EMPREINTE_SCREEN_LABELS[screenId];

  return (
    <div className="mb-8 flex w-full flex-col items-center gap-3">
      <div
        className="flex items-center gap-2"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={EMPREINTE_SCREEN_COUNT}
        aria-valuenow={current + 1}
        aria-label={`Étape ${current + 1} sur ${EMPREINTE_SCREEN_COUNT} : ${label}`}
      >
        {EMPREINTE_SCREENS.map((id, i) => (
          <span
            key={id}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === current
                ? "w-7 bg-brand-500"
                : i < current
                  ? "w-1.5 bg-brand-500/45"
                  : "w-1.5 bg-slate-200"
            )}
          />
        ))}
      </div>
      <p className="text-xs font-medium tracking-wide text-slate-400">
        {current + 1} / {EMPREINTE_SCREEN_COUNT}
        <span className="mx-1.5 text-slate-300">·</span>
        {label}
      </p>
    </div>
  );
}

async function fetchDvfHint(postalCode: string, surface: number): Promise<string | null> {
  try {
    const sqm = surface > 0 ? surface : 65;
    const res = await fetch(`/api/dvf?postalCode=${postalCode}&surface=${sqm}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { estimate?: number };
    if (!data.estimate) return null;
    return `~${Math.round(data.estimate).toLocaleString("fr-FR")} € dans votre zone (${sqm} m²)`;
  } catch {
    return null;
  }
}

function ScreenChrome({
  screenKey,
  title,
  children,
  canContinue,
  onContinue,
  whisper,
  progress,
}: {
  screenKey: string;
  title: string;
  children: ReactNode;
  canContinue: boolean;
  onContinue: () => void;
  whisper?: string;
  progress?: ReactNode;
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
      key={screenKey}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: -16 }}
      transition={{ duration: duration.slow, ease: ease.out }}
      className="flex w-full max-w-md flex-col items-center text-center"
      onKeyDown={handleKeyDown}
    >
      {progress}
      <h1 className="mb-10 text-xl font-medium tracking-tight text-slate-800 md:text-2xl">
        {title}
      </h1>

      <div className="flex w-full flex-col gap-8">{children}</div>

      {whisper && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 text-sm text-slate-500"
        >
          {whisper}
        </motion.p>
      )}

      <EmpreinteContinueButton onClick={onContinue} disabled={!canContinue} />
    </motion.div>
  );
}

function EmpreinteFlow() {
  const router = useRouter();
  const footprint = useSeparationStore((s) => s.footprint);
  const setFootprintField = useSeparationStore((s) => s.setFootprintField);
  const completeFootprint = useSeparationStore((s) => s.completeFootprint);
  const reduced = useReducedMotion();

  const [screen, setScreen] = useState(() => inferEmpreinteScreen(footprint));
  const [draft, setDraft] = useState<EmpreinteDraft>(() => footprintToDraft(footprint));
  const [dvfHint, setDvfHint] = useState<string | null>(null);
  const [dvfLoading, setDvfLoading] = useState(false);

  const screenId = EMPREINTE_SCREENS[screen] ?? "location";
  const canContinue = useMemo(() => isScreenValid(screenId, draft), [screenId, draft]);
  const loanOpen = hasActiveLoan(draft);

  const updateField = useCallback((field: FootprintField, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const goNext = () => {
    if (!canContinue) return;

    if (screenId === "location") {
      const postalCode = draft.postalCode.replace(/\D/g, "");
      setFootprintField("postalCode", postalCode);
    }

    if (screenId === "patrimoine") {
      setFootprintField("propertySurface", parseNumber(draft.propertySurface));
      setFootprintField("propertyValue", parseCurrency(draft.propertyValue));
      setFootprintField("purchasePrice", parseCurrency(draft.purchasePrice));
      const postal = (
        footprint.postalCode || draft.postalCode.replace(/\D/g, "")
      ).replace(/\D/g, "");
      if (postal.length === 5) {
        setDvfLoading(true);
        void fetchDvfHint(postal, parseNumber(draft.propertySurface)).then((hint) => {
          setDvfHint(hint);
          setDvfLoading(false);
        });
      }
    }

    if (screenId === "financement") {
      const crd = parseCurrency(draft.mortgageRemaining);
      setFootprintField("mortgageRemaining", crd);
      if (crd > 0) {
        setFootprintField(
          "monthlyMortgagePayment",
          parseCurrency(draft.monthlyMortgagePayment)
        );
        setFootprintField(
          "mortgageRemainingYears",
          parseNumber(draft.mortgageRemainingYears)
        );
      } else {
        setFootprintField("monthlyMortgagePayment", 0);
        setFootprintField("mortgageRemainingYears", 0);
        setDraft((prev) => ({
          ...prev,
          monthlyMortgagePayment: "",
          mortgageRemainingYears: "",
        }));
      }
    }

    if (screenId === "income_a") {
      setFootprintField("incomeA", parseCurrency(draft.incomeA));
    }

    if (screenId === "income_b") {
      setFootprintField("incomeB", parseCurrency(draft.incomeB));
      const ok = completeFootprint();
      if (ok) {
        sessionStorage.removeItem(EMPREINTE_STEP_KEY);
        router.push("/simulation/portes");
      }
      return;
    }

    const next = Math.min(screen + 1, EMPREINTE_SCREEN_COUNT - 1);
    sessionStorage.setItem(EMPREINTE_STEP_KEY, String(next));
    setScreen(next);
  };

  const progress = <EmpreinteProgress screenId={screenId} />;
  let body: ReactNode = null;

  if (screenId === "location") {
    body = (
      <EmpreinteField
        stepKey="location"
        label="Où est le bien ?"
        type="postal"
        value={draft.postalCode}
        onChange={(v) => updateField("postalCode", v)}
        onSubmit={goNext}
        placeholder="75011"
        canContinue={canContinue}
        progress={progress}
      />
    );
  } else if (screenId === "income_a") {
    body = (
      <EmpreinteField
        stepKey="income_a"
        label="Vos revenus nets, par mois ?"
        type="currency"
        value={draft.incomeA}
        onChange={(v) => updateField("incomeA", v)}
        onSubmit={goNext}
        placeholder="3 500"
        canContinue={canContinue}
        progress={progress}
      />
    );
  } else if (screenId === "income_b") {
    body = (
      <EmpreinteField
        stepKey="income_b"
        label="Et l'autre partie ?"
        type="currency"
        value={draft.incomeB}
        onChange={(v) => updateField("incomeB", v)}
        onSubmit={goNext}
        placeholder="2 800"
        canContinue={canContinue}
        progress={progress}
      />
    );
  } else if (screenId === "patrimoine") {
    body = (
      <ScreenChrome
        screenKey="patrimoine"
        title="Le patrimoine"
        canContinue={canContinue}
        onContinue={goNext}
        whisper={dvfLoading ? "Estimation locale en cours…" : (dvfHint ?? undefined)}
        progress={progress}
      >
        <EmpreinteFormRow
          id="propertySurface"
          label="Surface habitable"
          type="number"
          value={draft.propertySurface}
          onChange={(v) => updateField("propertySurface", v)}
          placeholder="65"
          suffix="m²"
          autoFocus
        />
        <EmpreinteFormRow
          id="propertyValue"
          label="Valeur actuelle estimée"
          type="currency"
          value={draft.propertyValue}
          onChange={(v) => updateField("propertyValue", v)}
          placeholder="400 000"
        />
        <EmpreinteFormRow
          id="purchasePrice"
          label="Prix d'achat initial"
          type="currency"
          value={draft.purchasePrice}
          onChange={(v) => updateField("purchasePrice", v)}
          placeholder="320 000"
          hint="Indiquez 0 si vous ne savez pas."
        />
      </ScreenChrome>
    );
  } else {
    body = (
      <ScreenChrome
        screenKey="financement"
        title="Le financement"
        canContinue={canContinue}
        onContinue={goNext}
        progress={progress}
      >
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

        <AnimatePresence initial={false}>
          {loanOpen && (
            <motion.div
              key="loan-details"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: duration.normal, ease: ease.out }}
              className="flex flex-col gap-8"
            >
              <p className="text-left text-xs font-medium text-slate-400">
                Détails du crédit en cours
              </p>
              <EmpreinteFormRow
                id="monthlyMortgagePayment"
                label="Mensualité actuelle"
                type="currency"
                value={draft.monthlyMortgagePayment}
                onChange={(v) => updateField("monthlyMortgagePayment", v)}
                placeholder="1 200"
                hint="Assurance comprise si possible."
              />
              <EmpreinteFormRow
                id="mortgageRemainingYears"
                label="Durée restante"
                type="number"
                value={draft.mortgageRemainingYears}
                onChange={(v) => updateField("mortgageRemainingYears", v)}
                placeholder="15"
                suffix="ans"
                hint="Horizon du refinancement indicatif."
              />
            </motion.div>
          )}
        </AnimatePresence>
      </ScreenChrome>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <div key={screenId} className="w-full">
        {body}
      </div>
    </AnimatePresence>
  );
}

export function EmpreinteShell() {
  const router = useRouter();
  const footprint = useSeparationStore((s) => s.footprint);
  const hydrated = useSeparationHydrated();

  useEffect(() => {
    if (hydrated && footprint.completedAt) {
      router.replace("/simulation/portes");
    }
  }, [hydrated, footprint.completedAt, router]);

  if (!hydrated || footprint.completedAt) {
    return (
      <div className={`${clarte.mesh} flex min-h-[100dvh] items-center justify-center`}>
        <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200/80" />
      </div>
    );
  }

  return (
    <div
      className={`${clarte.mesh} flex min-h-[100dvh] flex-col items-center justify-center px-6 py-16`}
    >
      <EmpreinteFlow />
    </div>
  );
}
