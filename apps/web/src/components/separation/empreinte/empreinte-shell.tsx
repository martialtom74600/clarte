"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { clarte } from "@/lib/clarte-design";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useSeparationStore } from "@/store/separation-store";
import { useSeparationHydrated } from "@/lib/separation/use-separation-hydrated";
import { useMarketBuySync } from "@/lib/market/use-market-buy-sync";
import {
  EmpreinteField,
  EmpreinteFormRow,
  EmpreinteStepNav,
  parseCurrency,
  parseNumber,
} from "./empreinte-field";
import {
  EMPREINTE_SCREENS,
  EMPREINTE_SCREEN_COUNT,
  EMPREINTE_SCREEN_INTENTS,
  EMPREINTE_SCREEN_LABELS,
  EMPREINTE_STEP_KEY,
  footprintToDraft,
  getScreenValidationHint,
  inferEmpreinteScreen,
  isFinancementValidForMode,
  isScreenValid,
  parseSharePercent,
  type EmpreinteDraft,
  type EmpreinteDraftField,
  type EmpreinteScreenId,
  type FinancementUiMode,
} from "./empreinte-screens";
import { EmpreinteApportsScreen } from "./empreinte-apports";
import { EmpreinteCadreJuridiqueScreen } from "./empreinte-cadre-juridique";
import { EmpreinteFinancementScreen } from "./empreinte-financement";
import { EmpreinteRevenusScreen } from "./empreinte-revenus";
import { resolveFinancementValues } from "./empreinte-amortization";
import { DEFAULT_MORTGAGE_INSURANCE_ANNUAL_RATE } from "@separation/engine";

function EmpreinteProgress({ screenId }: { screenId: EmpreinteScreenId }) {
  const index = EMPREINTE_SCREENS.indexOf(screenId);
  const current = index >= 0 ? index : 0;
  const label = EMPREINTE_SCREEN_LABELS[screenId];

  return (
    <div className="mb-8 flex w-full flex-col items-center gap-3">
      <div
        className="flex items-center justify-center gap-2"
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

async function fetchDvfEstimate(
  postalCode: string,
  surface: number
): Promise<{ estimatedValue: number; label: string } | null> {
  try {
    const sqm = surface > 0 ? surface : 65;
    const res = await fetch(`/api/dvf?postalCode=${postalCode}&surface=${sqm}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      estimatedValue?: number;
      source?: string;
    };
    if (!data.estimatedValue) return null;
    const rounded = Math.round(data.estimatedValue);
    const tag = data.source === "fallback" ? "indicatif" : "DVF";
    return {
      estimatedValue: rounded,
      label: `~${rounded.toLocaleString("fr-FR")} € dans votre zone (${sqm} m² · ${tag})`,
    };
  } catch {
    return null;
  }
}

function ScreenChrome({
  screenKey,
  title,
  subtitle,
  children,
  canContinue,
  onContinue,
  whisper,
  whisperAction,
  validationHint,
  progress,
  onBack,
}: {
  screenKey: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  canContinue: boolean;
  onContinue: () => void;
  whisper?: string;
  whisperAction?: { label: string; onClick: () => void };
  validationHint?: string;
  progress?: ReactNode;
  onBack?: () => void;
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
      className="mx-auto flex w-full max-w-md flex-col items-center text-center"
      onKeyDown={handleKeyDown}
    >
      {progress}
      <h1 className="mb-3 text-xl font-medium tracking-tight text-slate-800 md:text-2xl">
        {title}
      </h1>
      {subtitle && <p className="mb-10 max-w-sm text-sm text-slate-500">{subtitle}</p>}
      {!subtitle && <div className="mb-10" />}

      <div className="flex w-full flex-col gap-8 text-left">{children}</div>

      {whisper && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 flex w-full flex-col items-center gap-2"
        >
          <p className="text-sm text-slate-500">{whisper}</p>
          {whisperAction && (
            <button
              type="button"
              onClick={whisperAction.onClick}
              className="text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
            >
              {whisperAction.label}
            </button>
          )}
        </motion.div>
      )}

      {!canContinue && validationHint && (
        <p className="mt-6 max-w-sm text-xs leading-relaxed text-slate-400">{validationHint}</p>
      )}

      <EmpreinteStepNav
        onBack={onBack}
        onContinue={() => onContinue()}
        canContinue={canContinue}
      />
    </motion.div>
  );
}

function mergeDraftOverride(
  base: EmpreinteDraft,
  draftOverride?: EmpreinteDraft
): EmpreinteDraft | undefined {
  if (!draftOverride || typeof draftOverride !== "object" || "nativeEvent" in draftOverride) {
    return undefined;
  }
  return { ...base, ...draftOverride };
}

function EmpreinteFlow() {
  const router = useRouter();
  useMarketBuySync();
  const footprint = useSeparationStore((s) => s.footprint);
  const setFootprintField = useSeparationStore((s) => s.setFootprintField);
  const setFinancementFootprint = useSeparationStore((s) => s.setFinancementFootprint);
  const setCadreJuridique = useSeparationStore((s) => s.setCadreJuridique);
  const completeFootprintWithIncomes = useSeparationStore(
    (s) => s.completeFootprintWithIncomes
  );

  const [screen, setScreen] = useState(() => inferEmpreinteScreen(footprint));
  const [draft, setDraft] = useState<EmpreinteDraft>(() => footprintToDraft(footprint));
  const [dvfEstimate, setDvfEstimate] = useState<{
    estimatedValue: number;
    label: string;
  } | null>(null);
  const [dvfLoading, setDvfLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem("clarte-empreinte-screen");
    sessionStorage.removeItem("clarte-empreinte-step");
  }, []);

  const screenId = EMPREINTE_SCREENS[screen] ?? "location";
  const canContinue = useMemo(() => isScreenValid(screenId, draft), [screenId, draft]);
  const validationHint = useMemo(
    () => getScreenValidationHint(screenId, draft),
    [screenId, draft]
  );

  useEffect(() => {
    if (screenId !== "patrimoine") {
      setDvfLoading(false);
      return;
    }
    const postal = (
      draft.postalCode || footprint.postalCode || ""
    ).replace(/\D/g, "");
    const surface = parseNumber(draft.propertySurface) || footprint.propertySurface;
    if (postal.length !== 5 || surface <= 0) {
      setDvfEstimate(null);
      setDvfLoading(false);
      return;
    }
    let cancelled = false;
    setDvfLoading(true);
    void fetchDvfEstimate(postal, surface).then((estimate) => {
      if (cancelled) return;
      setDvfEstimate(estimate);
      setDvfLoading(false);
    });
    return () => {
      cancelled = true;
      setDvfLoading(false);
    };
  }, [screenId, draft.postalCode, draft.propertySurface, footprint.postalCode, footprint.propertySurface]);

  const updateField = useCallback((field: EmpreinteDraftField, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const patchDraft = useCallback((patch: Partial<EmpreinteDraft>) => {
    setDraft((prev) => {
      const hasChange = (Object.keys(patch) as (keyof EmpreinteDraft)[]).some(
        (key) => prev[key] !== patch[key]
      );
      return hasChange ? { ...prev, ...patch } : prev;
    });
  }, []);

  const advanceScreen = useCallback(() => {
    setScreen((prev) => {
      const next = Math.min(prev + 1, EMPREINTE_SCREEN_COUNT - 1);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(EMPREINTE_STEP_KEY, String(next));
      }
      return next;
    });
  }, []);

  const goBack = useCallback(() => {
    setScreen((prev) => {
      if (prev <= 0) return prev;
      const next = prev - 1;
      if (typeof window !== "undefined") {
        sessionStorage.setItem(EMPREINTE_STEP_KEY, String(next));
      }
      return next;
    });
  }, []);

  const showBack = screen > 0;
  const handleBack = showBack ? goBack : undefined;

  const advanceFromFinancement = useCallback(
    (merged: EmpreinteDraft, mode: FinancementUiMode) => {
      if (mode !== "no_credit" && !isFinancementValidForMode(merged, mode)) {
        return false;
      }

      // Avancer tout de suite : évite un remount sur financement si le store se met à jour avant.
      advanceScreen();
      setDraft(merged);

      const resolved = resolveFinancementValues(merged);
      setFinancementFootprint(resolved);
      setFootprintField("mortgageInsuranceRate", DEFAULT_MORTGAGE_INSURANCE_ANNUAL_RATE);
      setFootprintField("financementDeclared", true);

      const contribA = parseCurrency(merged.contributionA ?? "") || footprint.contributionA;
      const contribB = parseCurrency(merged.contributionB ?? "") || footprint.contributionB;
      const explicitPurchase = parseCurrency(merged.purchasePrice ?? "");
      // Prix saisi aux apports prioritaire ; sinon reconstitution prêt + apports.
      const purchasePrice =
        explicitPurchase > 0
          ? explicitPurchase
          : resolved.initialMortgagePrincipal > 0
            ? resolved.initialMortgagePrincipal + contribA + contribB
            : contribA + contribB;
      setFootprintField("purchasePrice", purchasePrice);

      if (resolved.mortgageRemaining === 0) {
        setDraft((prev) => ({
          ...prev,
          monthlyMortgagePayment: "",
          mortgageRemainingYears: "",
        }));
      }

      return true;
    },
    [advanceScreen, footprint.contributionA, footprint.contributionB, setFinancementFootprint, setFootprintField]
  );

  const goNext = (draftOverride?: EmpreinteDraft) => {
    const mergedOverride = mergeDraftOverride(draft, draftOverride);
    const activeDraft = mergedOverride ?? draft;

    let canProceed: boolean;
    if (mergedOverride) {
      canProceed = isScreenValid(screenId, activeDraft);
    } else {
      canProceed = canContinue;
    }
    if (!canProceed) return;

    if (mergedOverride) {
      setDraft(activeDraft);
    }

    if (screenId === "location") {
      const postalCode = (activeDraft.postalCode ?? "").replace(/\D/g, "");
      setFootprintField("postalCode", postalCode);
    }

    if (screenId === "patrimoine") {
      setFootprintField("propertySurface", parseNumber(activeDraft.propertySurface));
      setFootprintField("propertyValue", parseCurrency(activeDraft.propertyValue));
    }

    if (screenId === "cadre_juridique") {
      const status = activeDraft.legalStatus;
      if (status !== "marriage" && status !== "pacs" && status !== "concubinage") return;
      setCadreJuridique(
        status,
        parseSharePercent(activeDraft.ownershipShareA),
        parseSharePercent(activeDraft.ownershipShareB)
      );
    }

    if (screenId === "apports") {
      setFootprintField("purchasePrice", parseCurrency(activeDraft.purchasePrice ?? ""));
      setFootprintField("contributionA", parseCurrency(activeDraft.contributionA ?? ""));
      setFootprintField("contributionB", parseCurrency(activeDraft.contributionB ?? ""));
      setFootprintField("apportsDeclared", true);
    }

    if (screenId === "revenus") {
      const ok = completeFootprintWithIncomes(
        parseCurrency(activeDraft.incomeA),
        parseCurrency(activeDraft.incomeB)
      );
      if (ok) {
        sessionStorage.removeItem(EMPREINTE_STEP_KEY);
        router.push("/simulation/portes");
      }
      return;
    }

    advanceScreen();
  };

  const progress = <EmpreinteProgress screenId={screenId} />;
  let body: ReactNode = null;

  if (screenId === "location") {
    body = (
      <EmpreinteField
        stepKey="location"
        label="Où se trouve le bien ?"
        description={EMPREINTE_SCREEN_INTENTS.location}
        type="postal"
        value={draft.postalCode}
        onChange={(v) => updateField("postalCode", v)}
        onSubmit={() => goNext()}
        placeholder="74600"
        canContinue={canContinue}
        hint={validationHint ?? undefined}
        progress={progress}
        onBack={handleBack}
      />
    );
  } else if (screenId === "apports") {
    body = (
      <EmpreinteApportsScreen
        draft={draft}
        onDraftChange={patchDraft}
        onContinue={() => goNext()}
        canContinue={canContinue}
        validationHint={validationHint ?? undefined}
        onBack={handleBack}
        progress={progress}
      />
    );
  } else if (screenId === "revenus") {
    body = (
      <EmpreinteRevenusScreen
        draft={draft}
        onDraftChange={patchDraft}
        onContinue={() => goNext()}
        canContinue={canContinue}
        validationHint={validationHint ?? undefined}
        onBack={handleBack}
        progress={progress}
      />
    );
  } else if (screenId === "patrimoine") {
    const currentValue = parseCurrency(draft.propertyValue);
    const canApplyDvf =
      dvfEstimate != null &&
      dvfEstimate.estimatedValue > 0 &&
      currentValue !== dvfEstimate.estimatedValue;
    body = (
      <ScreenChrome
        screenKey="patrimoine"
        title="Le bien aujourd'hui"
        subtitle={EMPREINTE_SCREEN_INTENTS.patrimoine}
        canContinue={canContinue}
        onContinue={() => goNext()}
        whisper={
          dvfLoading
            ? "Estimation locale en cours…"
            : (dvfEstimate?.label ?? undefined)
        }
        whisperAction={
          canApplyDvf
            ? {
                label: "Utiliser cette estimation",
                onClick: () =>
                  updateField(
                    "propertyValue",
                    dvfEstimate.estimatedValue.toLocaleString("fr-FR")
                  ),
              }
            : undefined
        }
        validationHint={validationHint ?? undefined}
        onBack={handleBack}
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
          hint="Celle du bien actuel — pas le futur logement solo."
          autoFocus
        />
        <EmpreinteFormRow
          id="propertyValue"
          label="Valeur actuelle estimée"
          type="currency"
          value={draft.propertyValue}
          onChange={(v) => updateField("propertyValue", v)}
          placeholder="400 000"
          hint="Prix de vente réaliste aujourd'hui, pas le prix d'achat."
        />
      </ScreenChrome>
    );
  } else if (screenId === "cadre_juridique") {
    body = (
      <EmpreinteCadreJuridiqueScreen
        draft={draft}
        onDraftChange={patchDraft}
        onContinue={() => goNext()}
        canContinue={canContinue}
        validationHint={validationHint ?? undefined}
        onBack={handleBack}
        progress={progress}
      />
    );
  } else if (screenId === "financement") {
    body = (
      <EmpreinteFinancementScreen
        draft={draft}
        footprint={footprint}
        onDraftChange={patchDraft}
        onContinue={advanceFromFinancement}
        onBack={handleBack}
        progress={progress}
      />
    );
  }

  return (
    <div key={screenId} className="mx-auto w-full max-w-xl">
      {body}
    </div>
  );
}

function useClientMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function EmpreinteShell() {
  const router = useRouter();
  const footprint = useSeparationStore((s) => s.footprint);
  const hydrated = useSeparationHydrated();
  const mounted = useClientMounted();

  useEffect(() => {
    if (hydrated && footprint.completedAt) {
      router.replace("/simulation/portes");
    }
  }, [hydrated, footprint.completedAt, router]);

  const showFlow = mounted && hydrated && !footprint.completedAt;

  if (!showFlow) {
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
