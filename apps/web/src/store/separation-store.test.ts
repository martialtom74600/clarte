import { describe, it, expect, beforeEach } from "vitest";
import { create } from "zustand";
import type { SeparationStore } from "@/store/separation-store";
import {
  createInitialSeparationState,
  initialSeparationState,
} from "@/store/separation-store";
import {
  compileSimulationInput,
  isFootprintComplete,
  seedLabFromFootprint,
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
        const marketBuy =
          field === "postalCode" &&
          String(value) !== (state.marketBuy?.postalCode ?? "")
            ? null
            : state.marketBuy;
        const marketRent =
          field === "postalCode" &&
          String(value) !== (state.marketRent?.postalCode ?? "")
            ? null
            : state.marketRent;
        return withRecompute(
          { footprint, marketBuy, marketRent },
          { ...state, footprint, marketBuy, marketRent }
        );
      });
    },

    setMarketBuy: (marketBuy) => {
      set((state) => withRecompute({ marketBuy }, { ...state, marketBuy }));
    },

    setMarketRent: (marketRent) => {
      set((state) => withRecompute({ marketRent }, { ...state, marketRent }));
    },

    completeFootprint: () => {
      const { footprint, lab } = get();
      if (!isFootprintComplete(footprint)) return false;
      set((state) => {
        const nextFootprint = { ...state.footprint, completedAt: new Date().toISOString() };
        const nextLab = seedLabFromFootprint(nextFootprint, lab);
        return withRecompute(
          { stratum: "portes", footprint: nextFootprint, lab: nextLab },
          { ...state, stratum: "portes", footprint: nextFootprint, lab: nextLab }
        );
      });
      return true;
    },

    completeFootprintWithIncomes: (incomeA, incomeB) => {
      const { footprint, lab } = get();
      const nextBase = { ...footprint, incomeA, incomeB };
      if (!isFootprintComplete(nextBase)) return false;
      set((state) => {
        const nextFootprint = {
          ...state.footprint,
          incomeA,
          incomeB,
          completedAt: new Date().toISOString(),
        };
        const nextLab = seedLabFromFootprint(nextFootprint, lab);
        return withRecompute(
          { stratum: "portes", footprint: nextFootprint, lab: nextLab },
          { ...state, stratum: "portes", footprint: nextFootprint, lab: nextLab }
        );
      });
      return true;
    },

    reopenEmpreinte: () => {
      set((state) => {
        const footprint = { ...state.footprint, completedAt: null };
        const lab = { ...state.lab, activeDoor: null };
        return withRecompute(
          { stratum: "empreinte", footprint, lab },
          { ...state, stratum: "empreinte", footprint, lab }
        );
      });
    },

    setFinancementFootprint: (values) => {
      set((state) => {
        const footprint = { ...state.footprint, ...values };
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
        return withRecompute({ footprint, assumptions }, { ...state, footprint, assumptions });
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

    reset: () => set(createInitialSeparationState()),
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
    s.setFootprintField("legalStatus", "concubinage");
    s.setFootprintField("ownershipShareA", 50);
    s.setFootprintField("ownershipShareB", 50);
    s.setFootprintField("cadreJuridiqueDeclared", true);
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

  it("pré-active les leviers labo depuis l'Empreinte (apports + mensualité)", () => {
    fillCompleteFootprint();
    store.getState().setFootprintField("contributionA", 20000);
    store.getState().setFootprintField("contributionB", 15000);

    store.getState().completeFootprint();

    const { lab } = store.getState();
    expect(lab.enabledLevers).toContain("initial_contributions");
    expect(lab.enabledLevers).toContain("historical_mortgage_rate");
    expect(lab.overrides.initial_contributions).toEqual({
      contributionA: 20000,
      contributionB: 15000,
    });
    expect(lab.overrides.historical_mortgage_rate?.monthlyMortgagePayment).toBe(950);
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

  it("reopenEmpreinte conserve les données et efface completedAt", () => {
    fillCompleteFootprint();
    store.getState().completeFootprint();
    expect(store.getState().footprint.completedAt).not.toBeNull();

    store.getState().reopenEmpreinte();

    const state = store.getState();
    expect(state.stratum).toBe("empreinte");
    expect(state.footprint.completedAt).toBeNull();
    expect(state.footprint.postalCode).toBe("75011");
    expect(state.footprint.propertyValue).toBe(400000);
    expect(state.footprint.ownershipShareA).toBe(50);
    expect(state.lab.activeDoor).toBeNull();
  });

  it("reset remet le funnel à zéro pour une nouvelle saisie", () => {
    fillCompleteFootprint();
    store.getState().completeFootprint();
    store.getState().openDoor("keep_a");
    store.getState().setLeverOverride("initial_contributions", {
      contributionA: 10000,
      contributionB: 15000,
    });

    store.getState().reset();

    const state = store.getState();
    expect(state.stratum).toBe("empreinte");
    expect(state.footprint.postalCode).toBe("");
    expect(state.footprint.propertyValue).toBe(0);
    expect(state.footprint.completedAt).toBeNull();
    expect(state.derived.lastResult).toBeNull();
    expect(state.lab.activeDoor).toBeNull();
    expect(state.lab.enabledLevers).toEqual([]);
  });
});
