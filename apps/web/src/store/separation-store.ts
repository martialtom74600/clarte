"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DoorId, LeverId, RelationshipStatus } from "@separation/schemas";
import type {
  FootprintField,
  LabState,
  LeverOverrides,
  SeparationState,
} from "@/lib/separation/separation-types";
import {
  compileSimulationInput,
  defaultAssumptions,
  defaultFootprint,
  defaultLabState,
  isFootprintComplete,
  seedLabFromFootprint,
} from "@/lib/separation/compile-simulation-input";
import { recomputeSeparationDerived } from "@/lib/separation/recompute-derived";
import { EMPREINTE_STEP_KEY } from "@/components/separation/empreinte/empreinte-screens";
import type { ResolvedFinancementValues } from "@/components/separation/empreinte/empreinte-amortization";

export const STORAGE_KEY = "clarte-separation-v2";

/** Clés sessionStorage liées au funnel Empreinte (hors store persist). */
const EMPREINTE_LEGACY_STEP_KEY = "clarte-empreinte-step";

export function createInitialSeparationState(): SeparationState {
  return {
    stratum: "empreinte",
    footprint: defaultFootprint(),
    assumptions: defaultAssumptions(),
    lab: defaultLabState(),
    derived: {
      lastInput: null,
      lastResult: null,
      doorVerdicts: null,
      computedAt: null,
    },
    discreteMode: false,
  };
}

export const initialSeparationState = createInitialSeparationState();

export function clearSeparationPersistence(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(EMPREINTE_STEP_KEY);
  sessionStorage.removeItem(EMPREINTE_LEGACY_STEP_KEY);
}

export interface SeparationStore extends SeparationState {
  setFootprintField: (field: FootprintField, value: string | number | boolean) => void;
  setFinancementFootprint: (values: ResolvedFinancementValues) => void;
  setCadreJuridique: (
    legalStatus: RelationshipStatus,
    ownershipShareA: number,
    ownershipShareB: number
  ) => void;
  completeFootprint: () => boolean;
  completeFootprintWithIncomes: (incomeA: number, incomeB: number) => boolean;
  /** Rouvre l'Empreinte sans effacer les données déjà saisies. */
  reopenEmpreinte: () => void;
  openDoor: (doorId: DoorId) => void;
  closeLab: () => void;
  enableLever: (leverId: LeverId) => void;
  disableLever: (leverId: LeverId) => void;
  setLeverOverride: <K extends keyof LeverOverrides>(
    leverId: K,
    value: LeverOverrides[K]
  ) => void;
  setStratum: (stratum: SeparationState["stratum"]) => void;
  setDiscreteMode: (value: boolean) => void;
  recompute: () => void;
  getInput: () => ReturnType<typeof compileSimulationInput> | null;
  reset: () => void;
}

function withRecompute(
  partial: Partial<SeparationState>,
  current: SeparationState
): Partial<SeparationState> {
  const next = { ...current, ...partial };
  return {
    ...partial,
    derived: recomputeSeparationDerived(next),
  };
}

export const createSeparationStore = () =>
  create<SeparationStore>()(
    persist(
      (set, get) => ({
        ...initialSeparationState,

        setFootprintField: (field, value) => {
          set((state) =>
            withRecompute(
              {
                footprint: { ...state.footprint, [field]: value },
              },
              { ...state, footprint: { ...state.footprint, [field]: value } }
            )
          );
        },

        setFinancementFootprint: (values) => {
          set((state) => {
            const footprint = {
              ...state.footprint,
              mortgageRemaining: values.mortgageRemaining,
              monthlyMortgagePayment: values.monthlyMortgagePayment,
              mortgageRemainingYears: values.mortgageRemainingYears,
              initialMortgagePrincipal: values.initialMortgagePrincipal,
              initialMortgageDurationYears: values.initialMortgageDurationYears,
              mortgageStartMonth: values.mortgageStartMonth,
              mortgageStartYear: values.mortgageStartYear,
              initialMortgageRate: values.initialMortgageRate,
              mortgageInsuranceMonthly: values.mortgageInsuranceMonthly,
            };
            return withRecompute({ footprint }, { ...state, footprint });
          });
        },

        setCadreJuridique: (legalStatus, ownershipShareA, ownershipShareB) => {
          set((state) => {
            const footprint = {
              ...state.footprint,
              legalStatus,
              ownershipShareA,
              ownershipShareB,
              cadreJuridiqueDeclared: true,
            };
            const assumptions = {
              ...state.assumptions,
              status: legalStatus,
              shareA: ownershipShareA,
              shareB: ownershipShareB,
            };
            const next = { ...state, footprint, assumptions };
            return withRecompute({ footprint, assumptions }, next);
          });
        },

        completeFootprint: () => {
          const { footprint, lab } = get();
          if (!isFootprintComplete(footprint)) return false;

          const completedAt = new Date().toISOString();
          set((state) => {
            const nextFootprint = { ...state.footprint, completedAt };
            const nextLab = seedLabFromFootprint(nextFootprint, lab);
            return withRecompute(
              { stratum: "portes", footprint: nextFootprint, lab: nextLab },
              { ...state, stratum: "portes", footprint: nextFootprint, lab: nextLab }
            );
          });
          return true;
        },

        /** Écrit les revenus puis finalise l'empreinte en un seul état cohérent. */
        completeFootprintWithIncomes: (incomeA: number, incomeB: number) => {
          const { footprint, lab } = get();
          const nextFootprintBase = {
            ...footprint,
            incomeA,
            incomeB,
          };
          if (!isFootprintComplete(nextFootprintBase)) return false;

          const completedAt = new Date().toISOString();
          set((state) => {
            const nextFootprint = { ...state.footprint, incomeA, incomeB, completedAt };
            const nextLab = seedLabFromFootprint(nextFootprint, lab);
            return withRecompute(
              { stratum: "portes", footprint: nextFootprint, lab: nextLab },
              { ...state, stratum: "portes", footprint: nextFootprint, lab: nextLab }
            );
          });
          return true;
        },

        reopenEmpreinte: () => {
          if (typeof window !== "undefined") {
            sessionStorage.setItem(EMPREINTE_STEP_KEY, "0");
          }
          set((state) => {
            const footprint = { ...state.footprint, completedAt: null };
            const lab = { ...state.lab, activeDoor: null };
            return withRecompute(
              { stratum: "empreinte", footprint, lab },
              { ...state, stratum: "empreinte", footprint, lab }
            );
          });
        },

        openDoor: (doorId) => {
          set((state) => ({
            stratum: "laboratoire",
            lab: { ...state.lab, activeDoor: doorId },
          }));
        },

        closeLab: () => {
          set({ stratum: "portes", lab: { ...get().lab, activeDoor: null } });
        },

        enableLever: (leverId) => {
          set((state) => {
            const enabledLevers = state.lab.enabledLevers.includes(leverId)
              ? state.lab.enabledLevers
              : [...state.lab.enabledLevers, leverId];
            const next: SeparationState = {
              ...state,
              lab: { ...state.lab, enabledLevers },
            };
            return withRecompute({ lab: next.lab }, next);
          });
        },

        disableLever: (leverId) => {
          set((state) => {
            const overrides = { ...state.lab.overrides };
            delete overrides[leverId];
            const nextLab: LabState = {
              ...state.lab,
              enabledLevers: state.lab.enabledLevers.filter((id) => id !== leverId),
              overrides,
            };
            const next: SeparationState = { ...state, lab: nextLab };
            return withRecompute({ lab: nextLab }, next);
          });
        },

        setLeverOverride: (leverId, value) => {
          set((state) => {
            const nextLab: LabState = {
              ...state.lab,
              enabledLevers: state.lab.enabledLevers.includes(leverId)
                ? state.lab.enabledLevers
                : [...state.lab.enabledLevers, leverId],
              overrides: { ...state.lab.overrides, [leverId]: value },
            };
            const next: SeparationState = { ...state, lab: nextLab };
            return withRecompute({ lab: nextLab }, next);
          });
        },

        setStratum: (stratum) => set({ stratum }),

        setDiscreteMode: (discreteMode) => set({ discreteMode }),

        recompute: () => {
          set((state) => withRecompute({}, state));
        },

        getInput: () => {
          const state = get();
          if (!isFootprintComplete(state.footprint)) return null;
          return compileSimulationInput(state);
        },

        reset: () => {
          clearSeparationPersistence();
          set(createInitialSeparationState());
        },
      }),
      {
        name: STORAGE_KEY,
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({
          stratum: state.stratum,
          footprint: state.footprint,
          assumptions: state.assumptions,
          lab: state.lab,
          discreteMode: state.discreteMode,
        }),
        merge: (persisted, current) => {
          const p = persisted as Partial<SeparationState> | undefined;
          const merged: SeparationState = {
            ...current,
            stratum: p?.stratum ?? current.stratum,
            footprint: { ...current.footprint, ...p?.footprint },
            assumptions: { ...current.assumptions, ...p?.assumptions },
            lab: { ...current.lab, ...p?.lab },
            discreteMode: p?.discreteMode ?? current.discreteMode,
            derived: current.derived,
          };
          return {
            ...current,
            ...merged,
            derived: recomputeSeparationDerived(merged),
          };
        },
      }
    )
  );

export const useSeparationStore = createSeparationStore();
