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
      reset: () => set(initialWizardState),
    }),
    {
      name: "clarte-simulation",
      partialize: (state) => ({
        step: state.step,
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
        email: state.email,
        phone: state.phone,
        selectedScenario: state.selectedScenario,
        tenantId: state.tenantId,
        discreteMode: state.discreteMode,
        wowSeen: state.wowSeen,
      }),
    }
  )
);
