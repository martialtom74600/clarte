import { compileDoorVerdicts, runSimulation } from "@separation/engine";
import type { DerivedState, SeparationState } from "./separation-types";
import { compileSimulationInput, isFootprintComplete } from "./compile-simulation-input";

export function recomputeSeparationDerived(
  state: Pick<SeparationState, "footprint" | "assumptions" | "lab"> & {
    marketBuy?: SeparationState["marketBuy"];
    marketRent?: SeparationState["marketRent"];
  }
): DerivedState {
  if (!isFootprintComplete(state.footprint)) {
    return {
      lastInput: null,
      lastResult: null,
      doorVerdicts: null,
      computedAt: null,
    };
  }

  const lastInput = compileSimulationInput(state);
  const lastResult = runSimulation(lastInput);
  const doorVerdicts = compileDoorVerdicts(lastInput, lastResult);

  return {
    lastInput,
    lastResult,
    doorVerdicts,
    computedAt: Date.now(),
  };
}
