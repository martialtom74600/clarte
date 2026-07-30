"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WizardState } from "@/lib/wizard-state";
import { initialWizardState, wizardToSimulationInput } from "@/lib/wizard-state";
import type { SimulationInput, SimulationResult } from "@separation/schemas";
import { runSimulation } from "@separation/engine";

interface WizardStore extends WizardState {
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  update: (partial: Partial<WizardState>) => void;
  computeResult: () => SimulationResult | null;
  getInput: () => SimulationInput | null;
  reset: () => void;
}

export const useWizardStore = create<WizardStore>()(
  persist(
    (set, get) => ({
      ...initialWizardState,
      setStep: (step) => set({ step }),
      nextStep: () => set((s) => ({ step: Math.min(4, s.step + 1) })),
      prevStep: () => set((s) => ({ step: Math.max(0, s.step - 1) })),
      update: (partial) => set(partial),
      computeResult: () => {
        const state = get();
        if (!state.status || state.propertyValue <= 0) return null;

        const input = wizardToSimulationInput(state);
        const result = runSimulation(input);
        set({ lastResult: result, lastInput: input });
        return result;
      },
      getInput: () => {
        const state = get();
        if (!state.status) return null;
        return wizardToSimulationInput(state);
      },
      reset: () => set({ ...initialWizardState, discreteMode: get().discreteMode, tenantId: get().tenantId }),
    }),
    {
      name: "clarte-simulation",
      version: 3,
      migrate: (persisted, version) => {
        const prev = persisted as Partial<WizardState>;
        if (version < 3) {
          return {
            ...initialWizardState,
            discreteMode: prev.discreteMode ?? false,
            tenantId: prev.tenantId ?? initialWizardState.tenantId,
          };
        }
        return persisted as typeof persisted;
      },
      partialize: (state) => ({
        discreteMode: state.discreteMode,
        tenantId: state.tenantId,
      }),
    }
  )
);
