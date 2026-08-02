import type { Money, ScenarioType } from "@separation/schemas";
import type { CustodyType } from "./support.js";
import { eur, round } from "./utils.js";

export interface CashflowInput {
  incomeAMonthly: number;
  incomeBMonthly: number;
  postalCode?: string;
  scenario: ScenarioType;
  monthlyMortgageOrRent?: number;
  childSupportMonthly?: number;
  childSupportPayer?: "A" | "B";
  numberOfChildren?: number;
  custodyType?: CustodyType;
  selectedKeeper?: "A" | "B";
}

export interface PersonCashflow {
  income: Money;
  housing: Money;
  childSupport: Money;
  otherCosts: Money;
  remaining: Money;
  housingLabel: string;
}

export interface CashflowResult {
  personA: PersonCashflow;
  personB: PersonCashflow;
  householdBefore: Money;
  householdAfter: Money;
  lifestyleDropPercent: number;
  warning?: string;
}

const RENT_BY_DEPT: Record<string, number> = {
  "75": 22,
  "69": 14,
  "13": 16,
  "33": 13,
  "06": 18,
  default: 11,
};

function estimateRentPerSqm(postalCode?: string): number {
  if (!postalCode || postalCode.length < 2) return RENT_BY_DEPT.default;
  const dept = postalCode.slice(0, 2);
  return RENT_BY_DEPT[dept] ?? RENT_BY_DEPT.default;
}

function estimateHousing(
  scenario: ScenarioType,
  keeper: "A" | "B" | undefined,
  person: "A" | "B",
  mortgageOrRent: number,
  postalCode?: string
): { cost: number; label: string } {
  const rentEstimate = round(estimateRentPerSqm(postalCode) * 55);

  if (scenario === "rent_out") {
    const rentEstimate = round(estimateRentPerSqm(postalCode) * 55);
    return {
      cost: rentEstimate,
      label: "Loyer ailleurs (bien conservé en location)",
    };
  }

  if (scenario === "sell" || scenario === "sell_rent") {
    return {
      cost: rentEstimate,
      label:
        scenario === "sell_rent"
          ? "Loyer estimé (après vente, sans rachat)"
          : "Loyer estimé (après vente)",
    };
  }

  if (scenario === "keep_a") {
    if (person === "A") {
      return {
        cost: mortgageOrRent || rentEstimate,
        label: mortgageOrRent > 0 ? "Crédit immo conservé" : "Logement conservé",
      };
    }
    return { cost: rentEstimate, label: "Loyer estimé (nouveau logement)" };
  }

  if (scenario === "keep_b") {
    if (person === "B") {
      return {
        cost: mortgageOrRent || rentEstimate,
        label: mortgageOrRent > 0 ? "Crédit immo conservé" : "Logement conservé",
      };
    }
    return { cost: rentEstimate, label: "Loyer estimé (nouveau logement)" };
  }

  return { cost: rentEstimate, label: "Loyer estimé" };
}

export function computePostSeparationCashflow(input: CashflowInput): CashflowResult {
  const otherCostsFixed = 400;
  const childCosts =
    (input.numberOfChildren ?? 0) > 0
      ? (input.numberOfChildren ?? 0) * (input.custodyType === "alternate" ? 150 : 200)
      : 0;

  const householdBefore = input.incomeAMonthly + input.incomeBMonthly;

  const buildPerson = (person: "A" | "B"): PersonCashflow => {
    const income = person === "A" ? input.incomeAMonthly : input.incomeBMonthly;
    const housing = estimateHousing(
      input.scenario,
      input.selectedKeeper,
      person,
      input.monthlyMortgageOrRent ?? 0,
      input.postalCode
    );

    let childSupportOut = 0;
    let childSupportIn = 0;
    if (input.childSupportMonthly && input.childSupportPayer) {
      if (input.childSupportPayer === person) {
        childSupportOut = input.childSupportMonthly;
      } else {
        childSupportIn = input.childSupportMonthly;
      }
    }

    const otherCosts = otherCostsFixed + childCosts;
    const remaining =
      income - housing.cost - otherCosts - childSupportOut + childSupportIn;

    return {
      income: eur(income),
      housing: eur(housing.cost),
      childSupport: eur(childSupportOut || childSupportIn),
      otherCosts: eur(otherCosts),
      remaining: eur(remaining),
      housingLabel: housing.label,
    };
  };

  const personA = buildPerson("A");
  const personB = buildPerson("B");
  const householdAfter = personA.remaining.amount + personB.remaining.amount;

  const lifestyleDropPercent =
    householdBefore > 0
      ? round(((householdBefore - householdAfter) / householdBefore) * 100)
      : 0;

  const lowerRemaining = Math.min(personA.remaining.amount, personB.remaining.amount);
  let warning: string | undefined;
  if (lowerRemaining < 300) {
    warning =
      "L'un des deux budgets mensuels estimés est très serré (< 300 € restants). Anticipez une baisse de niveau de vie et explorez les options de prestation compensatoire.";
  } else if (lifestyleDropPercent > 25) {
    warning = `Le budget du foyer pourrait baisser d'environ ${lifestyleDropPercent}% après séparation.`;
  }

  return {
    personA,
    personB,
    householdBefore: eur(householdBefore),
    householdAfter: eur(householdAfter),
    lifestyleDropPercent,
    warning,
  };
}
