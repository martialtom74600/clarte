"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DoorId, LeverId } from "@separation/schemas";
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
} from "@/lib/separation/compile-simulation-input";
import { recomputeSeparationDerived } from "@/lib/separation/recompute-derived";
import { EMPREINTE_STEP_KEY } from "@/components/separation/empreinte/empreinte-screens";

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
  setFootprintField: (field: FootprintField, value: string | number) => void;
  completeFootprint: () => boolean;
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

        completeFootprint: () => {
          const { footprint } = get();
          if (!isFootprintComplete(footprint)) return false;

          set((state) =>
            withRecompute(
              {
                stratum: "portes",
                footprint: {
                  ...state.footprint,
                  completedAt: new Date().toISOString(),
                },
              },
              {
                ...state,
                stratum: "portes",
                footprint: {
                  ...state.footprint,
                  completedAt: new Date().toISOString(),
                },
              }
            )
          );
          return true;
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
