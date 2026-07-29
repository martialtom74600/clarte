import type { WizardState } from "./wizard-state";
import { wizardToSimulationInput } from "./wizard-state";
import {
  runSimulation,
  estimateChildSupport,
  analyzePatrimonyImbalance,
  compareResolutionPaths,
  computePostSeparationCashflow,
} from "@separation/engine";
import type { SimulationResult } from "@separation/schemas";

export function computePainPointInsights(state: WizardState, result?: SimulationResult | null) {
  const simulationResult = result ?? (state.propertyValue > 0 && state.status
    ? runSimulation(wizardToSimulationInput(state))
    : null);

  if (!simulationResult) {
    return {
      result: null,
      imbalance: null,
      childSupport: null,
      cashflow: null,
      resolution: null,
    };
  }

  const imbalance = analyzePatrimonyImbalance(
    simulationResult.netWorthByPerson.A.amount,
    simulationResult.netWorthByPerson.B.amount
  );

  const childSupport =
    state.numberOfChildren > 0 && (state.incomeAMonthly > 0 || state.incomeBMonthly > 0)
      ? estimateChildSupport({
          payerIncomeMonthly: state.incomeAMonthly,
          recipientIncomeMonthly: state.incomeBMonthly,
          numberOfChildren: state.numberOfChildren,
          custodyType: state.custodyType,
        })
      : null;

  const scenario = state.selectedScenario === "compare_all" ? "sell" : state.selectedScenario;
  const cashflow =
    state.incomeAMonthly > 0 || state.incomeBMonthly > 0
      ? computePostSeparationCashflow({
          incomeAMonthly: state.incomeAMonthly,
          incomeBMonthly: state.incomeBMonthly,
          postalCode: state.postalCode,
          scenario,
          monthlyMortgageOrRent: state.monthlyMortgagePayment,
          childSupportMonthly: childSupport?.monthlyAmount.amount,
          childSupportPayer: childSupport?.payerId,
          numberOfChildren: state.numberOfChildren,
          custodyType: state.custodyType,
          selectedKeeper: scenario === "keep_a" ? "A" : scenario === "keep_b" ? "B" : undefined,
        })
      : null;

  const resolution = compareResolutionPaths(simulationResult.complexityScore);

  return {
    result: simulationResult,
    imbalance,
    childSupport,
    cashflow,
    resolution,
  };
}

export function generateDocumentProofId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `CLT-${ts}-${rand}`;
}
