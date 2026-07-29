import type { SimulationInput } from "@separation/schemas";

export interface MediationFieldDiff {
  field: string;
  label: string;
  valueA: string | number;
  valueB: string | number;
  delta?: number;
  unit?: string;
}

export interface MediationComparison {
  diffs: MediationFieldDiff[];
  agreementRate: number;
  hasSignificantDisagreement: boolean;
}

function formatValue(v: unknown): string | number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return v;
  return String(v ?? "");
}

export function compareMediationInputs(
  inputA: Partial<SimulationInput> & {
    propertyValue?: number;
    mortgageRemaining?: number;
    incomeAMonthly?: number;
    incomeBMonthly?: number;
  },
  inputB: Partial<SimulationInput> & {
    propertyValue?: number;
    mortgageRemaining?: number;
    incomeAMonthly?: number;
    incomeBMonthly?: number;
  }
): MediationComparison {
  const fields: Array<{
    field: string;
    label: string;
    getA: () => string | number;
    getB: () => string | number;
    threshold?: number;
  }> = [
    {
      field: "propertyValue",
      label: "Valeur du bien",
      getA: () => inputA.propertyValue ?? inputA.assets?.[0]?.grossValue.amount ?? 0,
      getB: () => inputB.propertyValue ?? inputB.assets?.[0]?.grossValue.amount ?? 0,
      threshold: 0.05,
    },
    {
      field: "mortgageRemaining",
      label: "Crédit restant",
      getA: () =>
        inputA.mortgageRemaining ??
        inputA.liabilities?.find((l) => l.type === "mortgage")?.remainingBalance.amount ??
        0,
      getB: () =>
        inputB.mortgageRemaining ??
        inputB.liabilities?.find((l) => l.type === "mortgage")?.remainingBalance.amount ??
        0,
      threshold: 0.05,
    },
    {
      field: "incomeA",
      label: "Revenu mensuel A",
      getA: () => inputA.incomeAMonthly ?? inputA.persons?.[0]?.income?.amount ?? 0,
      getB: () => inputB.incomeAMonthly ?? inputB.persons?.[0]?.income?.amount ?? 0,
      threshold: 0.1,
    },
    {
      field: "incomeB",
      label: "Revenu mensuel B",
      getA: () => inputA.incomeBMonthly ?? inputA.persons?.[1]?.income?.amount ?? 0,
      getB: () => inputB.incomeBMonthly ?? inputB.persons?.[1]?.income?.amount ?? 0,
      threshold: 0.1,
    },
  ];

  const diffs: MediationFieldDiff[] = [];
  let agreed = 0;

  for (const f of fields) {
    const valueA = f.getA();
    const valueB = f.getB();
    const numA = Number(valueA);
    const numB = Number(valueB);
    const maxVal = Math.max(numA, numB, 1);
    const deltaPct = Math.abs(numA - numB) / maxVal;

    if (deltaPct <= (f.threshold ?? 0.05)) {
      agreed++;
    } else {
      diffs.push({
        field: f.field,
        label: f.label,
        valueA: formatValue(valueA),
        valueB: formatValue(valueB),
        delta: round(numA - numB),
        unit: f.field.includes("income") || f.field.includes("Value") || f.field.includes("mortgage") ? "€" : undefined,
      });
    }
  }

  return {
    diffs,
    agreementRate: round((agreed / fields.length) * 100),
    hasSignificantDisagreement: diffs.length >= 2,
  };
}

function round(n: number, d = 0) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
