import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import type { SeparationStore } from "@/store/separation-store";
import { initialSeparationState } from "@/store/separation-store";
import {
  compileSimulationInput,
  isFootprintComplete,
} from "@/lib/separation/compile-simulation-input";
import { recomputeSeparationDerived } from "@/lib/separation/recompute-derived";
import type { SeparationState } from "@/lib/separation/separation-types";

function withRecompute(
  partial: Partial<SeparationState>,
  current: SeparationState
): Partial<SeparationState> {
  const next = { ...current, ...partial };
  return { ...partial, derived: recomputeSeparationDerived(next) };
}

/** Store en mémoire pour tests — sans persist sessionStorage. */
function createTestSeparationStore() {
  return create<SeparationStore>()((set, get) => ({
    ...initialSeparationState,

    setFootprintField: (field, value) => {
      set((state) => {
        const footprint = { ...state.footprint, [field]: value };
        return withRecompute({ footprint }, { ...state, footprint });
      });
    },

    completeFootprint: () => {
      const { footprint } = get();
      if (!isFootprintComplete(footprint)) return false;
      set((state) => {
        const nextFootprint = { ...state.footprint, completedAt: new Date().toISOString() };
        return withRecompute(
          { stratum: "portes", footprint: nextFootprint },
          { ...state, stratum: "portes", footprint: nextFootprint }
        );
      });
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
        const next: SeparationState = { ...state, lab: { ...state.lab, enabledLevers } };
        return withRecompute({ lab: next.lab }, next);
      });
    },

    disableLever: (leverId) => {
      set((state) => {
        const overrides = { ...state.lab.overrides };
        delete overrides[leverId];
        const nextLab = {
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
        const nextLab = {
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

    reset: () => set({ ...initialSeparationState }),
  }));
}

describe("SeparationStore (in-memory)", () => {
  let store: ReturnType<typeof createTestSeparationStore>;

  beforeEach(() => {
    store = createTestSeparationStore();
  });

  const fillCompleteFootprint = () => {
    const s = store.getState();
    s.setFootprintField("postalCode", "75011");
    s.setFootprintField("propertyValue", 400000);
    s.setFootprintField("propertySurface", 65);
    s.setFootprintField("purchasePrice", 320000);
    s.setFootprintField("mortgageRemaining", 200000);
    s.setFootprintField("monthlyMortgagePayment", 950);
    s.setFootprintField("mortgageRemainingYears", 15);
    s.setFootprintField("incomeA", 5000);
    s.setFootprintField("incomeB", 4000);
  };

  it("progresse footprint → portes avec recompute", () => {
    fillCompleteFootprint();

    expect(store.getState().derived.lastResult).not.toBeNull();
    expect(store.getState().derived.doorVerdicts?.keep_a).toBeDefined();

    const ok = store.getState().completeFootprint();
    expect(ok).toBe(true);
    expect(store.getState().stratum).toBe("portes");
    expect(store.getState().footprint.completedAt).not.toBeNull();
  });

  it("injecte un levier apports et met à jour les verdicts", () => {
    fillCompleteFootprint();

    const before = store.getState().derived.lastResult?.scenarios.find(
      (sc) => sc.scenario === "keep_a"
    )?.soulte?.amount.amount;

    store.getState().setLeverOverride("initial_contributions", {
      contributionA: 20000,
      contributionB: 30000,
    });

    const after = store.getState().derived.lastResult?.scenarios.find(
      (sc) => sc.scenario === "keep_a"
    )?.soulte?.amount.amount;

    expect(after).toBeGreaterThan(before!);
    expect(store.getState().lab.enabledLevers).toContain("initial_contributions");
  });

  it("revert apports quand le levier est désactivé", () => {
    fillCompleteFootprint();

    const baseline = store.getState().derived.lastResult?.scenarios.find(
      (sc) => sc.scenario === "keep_a"
    )?.soulte?.amount.amount;

    store.getState().setLeverOverride("initial_contributions", {
      contributionA: 20000,
      contributionB: 30000,
    });
    store.getState().disableLever("initial_contributions");

    const reverted = store.getState().derived.lastResult?.scenarios.find(
      (sc) => sc.scenario === "keep_a"
    )?.soulte?.amount.amount;

    expect(reverted).toBe(baseline);
    expect(store.getState().getInput()?.contributionA).toBeUndefined();
  });

  it("ouvre le laboratoire sur une porte sans perdre derived", () => {
    fillCompleteFootprint();
    store.getState().completeFootprint();

    const verdictsBefore = store.getState().derived.doorVerdicts;
    store.getState().openDoor("rent_out");

    expect(store.getState().stratum).toBe("laboratoire");
    expect(store.getState().lab.activeDoor).toBe("rent_out");
    expect(store.getState().derived.doorVerdicts).toEqual(verdictsBefore);
  });
});
