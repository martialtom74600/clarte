"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { QuickEstimateInput } from "@separation/schemas";
import type { WizardState } from "@/lib/wizard-state";
import {
  computeDataTier,
  initialWizardState,
  intentToScenario,
  wizardToSimulationInput,
} from "@/lib/wizard-state";
import type { SimulationInput, SimulationResult } from "@separation/schemas";
import { runSimulation } from "@separation/engine";
import { computeQuickEstimate } from "@/lib/quick-estimate";
import { computeDossierProgress } from "@/lib/dossier-progress";

interface WizardStore extends WizardState {
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  setFlowPhase: (phase: WizardState["flowPhase"]) => void;
  enterNarrative: () => void;
  enterScenarios: () => void;
  enterSecure: () => void;
  update: (partial: Partial<WizardState>) => void;
  computeResult: () => SimulationResult | null;
  computeQuickEstimateFromState: () => void;
  getInput: () => SimulationInput | null;
  reset: () => void;
}

const PREFERENCES_KEY = "clarte-preferences";

function readPreferences(): Pick<WizardState, "discreteMode" | "tenantId"> {
  if (typeof window === "undefined") {
    return { discreteMode: false, tenantId: initialWizardState.tenantId };
  }
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return { discreteMode: false, tenantId: initialWizardState.tenantId };
    const parsed = JSON.parse(raw) as Partial<Pick<WizardState, "discreteMode" | "tenantId">>;
    return {
      discreteMode: parsed.discreteMode ?? false,
      tenantId: parsed.tenantId ?? initialWizardState.tenantId,
    };
  } catch {
    return { discreteMode: false, tenantId: initialWizardState.tenantId };
  }
}

function writePreferences(partial: Partial<Pick<WizardState, "discreteMode" | "tenantId">>) {
  if (typeof window === "undefined") return;
  const current = readPreferences();
  localStorage.setItem(
    PREFERENCES_KEY,
    JSON.stringify({ ...current, ...partial })
  );
}

function refreshDataTier(state: WizardState): WizardState["dataTier"] {
  const { readyForScenarios } = computeDossierProgress(state);
  return computeDataTier(state, readyForScenarios);
}

function dossierSnapshot(state: WizardStore): Partial<WizardState> {
  return {
    step: state.step,
    flowPhase: state.flowPhase,
    intent: state.intent,
    dataTier: state.dataTier,
    quickEstimate: state.quickEstimate,
    atelierEntities: state.atelierEntities,
    propertyValueAdjustment: state.propertyValueAdjustment,
    propertySurface: state.propertySurface,
    propertyValueMode: state.propertyValueMode,
    dvfMedianPricePerSqm: state.dvfMedianPricePerSqm,
    contributionA: state.contributionA,
    contributionB: state.contributionB,
    status: state.status,
    marriageRegime: state.marriageRegime,
    marriageDate: state.marriageDate,
    pacsDate: state.pacsDate,
    hasMinorChildren: state.hasMinorChildren,
    numberOfChildren: state.numberOfChildren,
    custodyType: state.custodyType,
    incomeAMonthly: state.incomeAMonthly,
    incomeBMonthly: state.incomeBMonthly,
    monthlyMortgagePayment: state.monthlyMortgagePayment,
    mediationToken: state.mediationToken,
    mediationLink: state.mediationLink,
    documentProofId: state.documentProofId,
    shareToken: state.shareToken,
    urgencyMonths: state.urgencyMonths,
    postalCode: state.postalCode,
    propertyAddress: state.propertyAddress,
    propertyValue: state.propertyValue,
    mortgageRemaining: state.mortgageRemaining,
    shareA: state.shareA,
    shareB: state.shareB,
    savingsJoint: state.savingsJoint,
    savingsA: state.savingsA,
    savingsB: state.savingsB,
    personalDebtsA: state.personalDebtsA,
    personalDebtsB: state.personalDebtsB,
    selectedScenario: state.selectedScenario,
    email: state.email,
    phone: state.phone,
    optInPartnerMatch: state.optInPartnerMatch,
    wowSeen: state.wowSeen,
    lastResult: state.lastResult,
    lastInput: state.lastInput,
  };
}

function normalizeFlowPhase(phase: string | undefined): WizardState["flowPhase"] {
  if (phase === "narrative" || phase === "scenarios" || phase === "secure") {
    return phase;
  }
  if (
    phase === "hook" ||
    phase === "atelier" ||
    phase === "revelation" ||
    phase === "new_life_cap"
  ) {
    return "narrative";
  }
  if (phase === "secure") return "secure";
  return "narrative";
}

function migratePersistedState(persisted: Partial<WizardState>, version: number): Partial<WizardState> {
  const normalizedPhase = normalizeFlowPhase(persisted.flowPhase as string | undefined);

  if (version >= 9) {
    return {
      ...persisted,
      flowPhase: normalizedPhase,
      contributionA: persisted.contributionA ?? 0,
      contributionB: persisted.contributionB ?? 0,
      propertySurface: persisted.propertySurface ?? 0,
      propertyValueMode: persisted.propertyValueMode ?? "dvf",
      dvfMedianPricePerSqm: persisted.dvfMedianPricePerSqm ?? null,
    };
  }

  const hasLegacyData = Boolean(persisted.status || persisted.propertyValue);
  let flowPhase: WizardState["flowPhase"] = "narrative";
  if (persisted.lastResult) {
    flowPhase = persisted.step && persisted.step >= 4 ? "secure" : "scenarios";
  } else if (hasLegacyData && persisted.propertyValue && persisted.propertyValue > 0) {
    flowPhase = "narrative";
  }

  return {
    ...persisted,
    flowPhase: normalizedPhase === "narrative" ? flowPhase : normalizedPhase,
    intent: persisted.intent ?? null,
    dataTier: persisted.quickEstimate ? "snapshot" : persisted.dataTier ?? "empty",
    quickEstimate: persisted.quickEstimate ?? null,
    atelierEntities: persisted.atelierEntities ?? [],
    propertyValueAdjustment: persisted.propertyValueAdjustment ?? 0,
    contributionA: persisted.contributionA ?? 0,
    contributionB: persisted.contributionB ?? 0,
    propertySurface: persisted.propertySurface ?? 0,
    propertyValueMode: persisted.propertyValueMode ?? "dvf",
    dvfMedianPricePerSqm: persisted.dvfMedianPricePerSqm ?? null,
  };
}

export const useWizardStore = create<WizardStore>()(
  persist(
    (set, get) => ({
      ...initialWizardState,
      setStep: (step) => set({ step }),
      nextStep: () => set((s) => ({ step: Math.min(4, s.step + 1) })),
      prevStep: () => set((s) => ({ step: Math.max(0, s.step - 1) })),
      setFlowPhase: (flowPhase) => set({ flowPhase }),
      enterNarrative: () => set({ flowPhase: "narrative", step: 0 }),
      enterScenarios: () => {
        const state = get();
        const result = state.lastResult ?? get().computeResult();
        if (!result) return;
        const selectedScenario =
          state.selectedScenario === "compare_all" && state.intent
            ? intentToScenario(state.intent)
            : state.selectedScenario;
        set({
          flowPhase: "scenarios",
          step: 3,
          wowSeen: true,
          dataTier: "complete",
          selectedScenario,
          lastResult: result,
        });
      },
      enterSecure: () => set({ flowPhase: "secure", step: 4 }),
      update: (partial) => {
        if ("discreteMode" in partial || "tenantId" in partial) {
          writePreferences({
            discreteMode: partial.discreteMode ?? get().discreteMode,
            tenantId: partial.tenantId ?? get().tenantId,
          });
        }
        if (partial.intent) {
          partial.selectedScenario = intentToScenario(partial.intent);
        }
        set((s) => {
          const next = { ...s, ...partial };
          return {
            ...next,
            dataTier: refreshDataTier(next),
          };
        });
      },
      computeResult: () => {
        const state = get();
        if (!state.status || state.propertyValue <= 0) return null;

        const input = wizardToSimulationInput(state);
        const result = runSimulation(input);
        set({
          lastResult: result,
          lastInput: input,
          dataTier: refreshDataTier({ ...state, lastResult: result }),
        });
        return result;
      },
      computeQuickEstimateFromState: () => {
        const state = get();
        if (!state.status || !state.intent || state.propertyValue <= 0) return;

        const variance = Math.abs(state.propertyValueAdjustment) / 100;
        const input: QuickEstimateInput = {
          status: state.status,
          marriageRegime:
            state.status === "marriage" ? state.marriageRegime : undefined,
          intent: state.intent,
          propertyValue: state.propertyValue,
          mortgageRemaining: state.mortgageRemaining,
          shareA: state.shareA,
          shareB: state.shareB,
          postalCode: state.postalCode,
          propertySurface: state.propertySurface || undefined,
          propertyValueMode: state.propertyValueMode,
          propertyValueVariance: variance > 0 ? variance : 0.2,
        };
        const quickEstimate = computeQuickEstimate(input);
        set({
          quickEstimate,
          dataTier: "snapshot",
        });
      },
      getInput: () => {
        const state = get();
        if (!state.status) return null;
        return wizardToSimulationInput(state);
      },
      reset: () => {
        const prefs = readPreferences();
        set({ ...initialWizardState, ...prefs });
      },
    }),
    {
      name: "clarte-simulation",
      version: 9,
      storage: createJSONStorage(() => sessionStorage),
      migrate: (persisted, version) => {
        const prefs = readPreferences();
        if (version < 4) {
          return { ...initialWizardState, ...prefs };
        }
        const migrated = migratePersistedState(persisted as Partial<WizardState>, version);
        return { ...initialWizardState, ...prefs, ...migrated };
      },
      partialize: (state) => dossierSnapshot(state),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<WizardState>),
        ...readPreferences(),
      }),
    }
  )
);
