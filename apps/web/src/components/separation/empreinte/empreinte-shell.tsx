"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { clarte } from "@/lib/clarte-design";
import { useSeparationStore } from "@/store/separation-store";
import { useSeparationHydrated } from "@/lib/separation/use-separation-hydrated";
import type { FootprintField, FootprintState } from "@/lib/separation/separation-types";
import {
  EmpreinteField,
  parseCurrency,
  parseNumber,
  type EmpreinteFieldType,
} from "./empreinte-field";

type StepDef = {
  field: FootprintField;
  label: string;
  type: EmpreinteFieldType;
  placeholder: string;
  hint?: string;
  suffix?: string;
  /** Autorise 0 (ex. pas de crédit, prix d'achat inconnu). */
  allowZero?: boolean;
};

const CORE_STEPS: StepDef[] = [
  {
    field: "postalCode",
    label: "Où est le bien ?",
    type: "postal",
    placeholder: "75011",
  },
  {
    field: "propertyValue",
    label: "Sa valeur aujourd'hui, à peu près ?",
    type: "currency",
    placeholder: "400 000",
  },
  {
    field: "propertySurface",
    label: "Quelle surface habitable ?",
    type: "number",
    placeholder: "65",
    suffix: "m²",
    hint: "Utile pour le loyer zone et le relogement.",
  },
  {
    field: "purchasePrice",
    label: "Vous l'aviez acheté combien ?",
    type: "currency",
    placeholder: "320 000",
    hint: "Prix d'achat à l'époque. Indiquez 0 si vous ne savez pas.",
    allowZero: true,
  },
  {
    field: "mortgageRemaining",
    label: "Il reste combien sur le crédit ?",
    type: "currency",
    placeholder: "200 000",
    hint: "Indiquez 0 s'il n'y a plus de crédit.",
    allowZero: true,
  },
];

const LOAN_STEPS: StepDef[] = [
  {
    field: "monthlyMortgagePayment",
    label: "Quelle est la mensualité actuelle ?",
    type: "currency",
    placeholder: "1 200",
    hint: "Assurance comprise si possible — ça change keep et location.",
  },
  {
    field: "mortgageRemainingYears",
    label: "Combien d'années restent sur le prêt ?",
    type: "number",
    placeholder: "15",
    suffix: "ans",
    hint: "Durée restante : horizon du refinancement indicatif.",
  },
];

const INCOME_STEPS: StepDef[] = [
  {
    field: "incomeA",
    label: "Vos revenus nets, par mois ?",
    type: "currency",
    placeholder: "3 500",
  },
  {
    field: "incomeB",
    label: "Et l'autre partie ?",
    type: "currency",
    placeholder: "2 800",
  },
];

function buildSteps(mortgageRemaining: number): StepDef[] {
  return [
    ...CORE_STEPS,
    ...(mortgageRemaining > 0 ? LOAN_STEPS : []),
    ...INCOME_STEPS,
  ];
}

type Draft = Record<FootprintField, string>;

function footprintToDraft(footprint: FootprintState): Draft {
  const fmt = (n: number, showZero = false) =>
    n > 0 || showZero ? n.toLocaleString("fr-FR") : "";
  return {
    postalCode: footprint.postalCode,
    propertyValue: footprint.propertyValue > 0 ? fmt(footprint.propertyValue) : "",
    propertySurface: footprint.propertySurface > 0 ? String(footprint.propertySurface) : "",
    purchasePrice:
      footprint.purchasePrice > 0
        ? fmt(footprint.purchasePrice)
        : footprint.completedAt
          ? "0"
          : "",
    mortgageRemaining:
      footprint.mortgageRemaining > 0
        ? fmt(footprint.mortgageRemaining)
        : footprint.incomeA > 0 || footprint.completedAt
          ? "0"
          : "",
    monthlyMortgagePayment:
      footprint.monthlyMortgagePayment > 0 ? fmt(footprint.monthlyMortgagePayment) : "",
    mortgageRemainingYears:
      footprint.mortgageRemainingYears > 0 ? String(footprint.mortgageRemainingYears) : "",
    incomeA: footprint.incomeA > 0 ? fmt(footprint.incomeA) : "",
    incomeB: footprint.incomeB > 0 ? fmt(footprint.incomeB) : "",
  };
}

function inferStep(footprint: FootprintState): number {
  const mortgage = footprint.mortgageRemaining;
  const steps = buildSteps(mortgage > 0 || footprint.monthlyMortgagePayment > 0 ? Math.max(mortgage, 1) : mortgage);
  const saved =
    typeof window !== "undefined" ? sessionStorage.getItem("clarte-empreinte-step") : null;
  const savedStep = saved != null ? Number(saved) : NaN;
  if (!Number.isNaN(savedStep) && savedStep >= 0 && savedStep < steps.length) {
    return savedStep;
  }

  for (let i = 0; i < steps.length; i++) {
    const field = steps[i]!.field;
    if (field === "postalCode" && footprint.postalCode.length < 5) return i;
    if (field === "propertyValue" && footprint.propertyValue <= 0) return i;
    if (field === "propertySurface" && footprint.propertySurface <= 0) return i;
    if (field === "purchasePrice" && footprint.purchasePrice < 0) return i;
    if (field === "mortgageRemaining" && footprint.mortgageRemaining < 0) return i;
    if (field === "monthlyMortgagePayment" && footprint.monthlyMortgagePayment <= 0) return i;
    if (field === "mortgageRemainingYears" && footprint.mortgageRemainingYears <= 0) return i;
    if (field === "incomeA" && footprint.incomeA <= 0) return i;
    if (field === "incomeB" && footprint.incomeB <= 0) return i;
  }
  return Math.max(0, steps.length - 1);
}

async function fetchDvfHint(postalCode: string, surface: number): Promise<string | null> {
  try {
    const sqm = surface > 0 ? surface : 65;
    const res = await fetch(`/api/dvf?postalCode=${postalCode}&surface=${sqm}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { estimate?: number };
    if (!data.estimate) return null;
    return `~${Math.round(data.estimate).toLocaleString("fr-FR")} € dans votre zone (${sqm} m²)`;
  } catch {
    return null;
  }
}

function EmpreinteFlow() {
  const router = useRouter();
  const footprint = useSeparationStore((s) => s.footprint);
  const setFootprintField = useSeparationStore((s) => s.setFootprintField);
  const completeFootprint = useSeparationStore((s) => s.completeFootprint);

  const [mortgageGate, setMortgageGate] = useState(
    () => footprint.mortgageRemaining > 0 || footprint.monthlyMortgagePayment > 0
  );
  const steps = useMemo(
    () => buildSteps(mortgageGate ? Math.max(footprint.mortgageRemaining, 1) : 0),
    [mortgageGate, footprint.mortgageRemaining]
  );

  const [step, setStep] = useState(() => inferStep(footprint));
  const [draft, setDraft] = useState(() => footprintToDraft(footprint));
  const [dvfHint, setDvfHint] = useState<string | null>(null);
  const [dvfLoading, setDvfLoading] = useState(false);

  // Clamp si les étapes loan disparaissent (CRD → 0).
  const safeStep = Math.min(step, Math.max(0, steps.length - 1));
  const currentStep = steps[safeStep];

  const draftValue = useMemo(() => {
    if (!currentStep) return "";
    return draft[currentStep.field];
  }, [currentStep, draft]);

  const updateDraft = useCallback(
    (value: string) => {
      if (!currentStep) return;
      setDraft((prev) => ({ ...prev, [currentStep.field]: value }));
    },
    [currentStep]
  );

  const validateStep = (): boolean => {
    if (!currentStep) return false;
    const raw = draft[currentStep.field];
    if (currentStep.type === "postal") {
      return raw.replace(/\D/g, "").length === 5;
    }
    if (currentStep.type === "number") {
      const n = parseNumber(raw);
      if (currentStep.field === "mortgageRemainingYears") {
        return n >= 1 && n <= 30;
      }
      return n > 0;
    }
    if (currentStep.allowZero) {
      return parseCurrency(raw) >= 0 && raw.trim() !== "";
    }
    return parseCurrency(raw) > 0;
  };

  const commitStep = () => {
    if (!currentStep || !validateStep()) return;

    let committedMortgage = footprint.mortgageRemaining;

    if (currentStep.type === "postal") {
      const postalCode = draft.postalCode.replace(/\D/g, "");
      setFootprintField("postalCode", postalCode);
    } else if (currentStep.type === "number") {
      const n = parseNumber(draft[currentStep.field]);
      setFootprintField(currentStep.field, n);
    } else {
      const amount = parseCurrency(draft[currentStep.field]);
      setFootprintField(currentStep.field, amount);
      if (currentStep.field === "mortgageRemaining") {
        committedMortgage = amount;
        const hasLoan = amount > 0;
        setMortgageGate(hasLoan);
        if (!hasLoan) {
          setFootprintField("monthlyMortgagePayment", 0);
          setFootprintField("mortgageRemainingYears", 0);
        }
      }
    }

    const nextSteps = buildSteps(
      currentStep.field === "mortgageRemaining"
        ? committedMortgage
        : mortgageGate
          ? Math.max(committedMortgage, 1)
          : 0
    );

    if (safeStep >= nextSteps.length - 1) {
      const ok = completeFootprint();
      if (ok) {
        sessionStorage.removeItem("clarte-empreinte-step");
        router.push("/simulation/portes");
      }
      return;
    }

    const nextStep = safeStep + 1;
    sessionStorage.setItem("clarte-empreinte-step", String(nextStep));
    setStep(nextStep);
    setDvfHint(null);

    if (currentStep.field === "postalCode") {
      const postalCode = draft.postalCode.replace(/\D/g, "");
      const surface = parseNumber(draft.propertySurface) || footprint.propertySurface || 65;
      setDvfLoading(true);
      void fetchDvfHint(postalCode, surface).then((hint) => {
        setDvfHint(hint);
        setDvfLoading(false);
      });
    }
  };

  const valueStepIndex = steps.findIndex((s) => s.field === "propertyValue");

  return (
    <AnimatePresence mode="wait">
      {currentStep && (
        <EmpreinteField
          key={currentStep.field}
          stepKey={currentStep.field}
          label={currentStep.label}
          type={currentStep.type}
          value={draftValue}
          onChange={updateDraft}
          onSubmit={commitStep}
          placeholder={currentStep.placeholder}
          hint={currentStep.hint}
          suffix={currentStep.suffix}
          whisper={
            safeStep === valueStepIndex && dvfLoading
              ? "Estimation locale en cours…"
              : safeStep === valueStepIndex && dvfHint
                ? dvfHint
                : undefined
          }
        />
      )}
    </AnimatePresence>
  );
}

export function EmpreinteShell() {
  const router = useRouter();
  const footprint = useSeparationStore((s) => s.footprint);
  const hydrated = useSeparationHydrated();

  useEffect(() => {
    if (hydrated && footprint.completedAt) {
      router.replace("/simulation/portes");
    }
  }, [hydrated, footprint.completedAt, router]);

  if (!hydrated || footprint.completedAt) {
    return (
      <div className={`${clarte.mesh} flex min-h-[100dvh] items-center justify-center`}>
        <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200/80" />
      </div>
    );
  }

  return (
    <div
      className={`${clarte.mesh} flex min-h-[100dvh] flex-col items-center justify-center px-6 py-16`}
    >
      <EmpreinteFlow />
    </div>
  );
}
