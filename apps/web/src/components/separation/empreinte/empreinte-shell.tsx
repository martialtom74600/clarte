"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { clarte } from "@/lib/clarte-design";
import { useSeparationStore } from "@/store/separation-store";
import { useSeparationHydrated } from "@/lib/separation/use-separation-hydrated";
import type { FootprintField } from "@/lib/separation/separation-types";
import { EmpreinteField, parseCurrency } from "./empreinte-field";

const STEPS = [
  {
    field: "postalCode" as FootprintField,
    label: "Où est le bien ?",
    type: "postal" as const,
    placeholder: "75011",
  },
  {
    field: "propertyValue" as FootprintField,
    label: "Sa valeur, à peu près ?",
    type: "currency" as const,
    placeholder: "400 000",
  },
  {
    field: "mortgageRemaining" as FootprintField,
    label: "Il reste combien sur le crédit ?",
    type: "currency" as const,
    placeholder: "200 000",
    hint: "Indiquez 0 s'il n'y a plus de crédit.",
  },
  {
    field: "incomeA" as FootprintField,
    label: "Vos revenus nets, par mois ?",
    type: "currency" as const,
    placeholder: "3 500",
  },
  {
    field: "incomeB" as FootprintField,
    label: "Et l'autre partie ?",
    type: "currency" as const,
    placeholder: "2 800",
  },
] as const;

function inferStep(footprint: {
  postalCode: string;
  propertyValue: number;
  incomeA: number;
  incomeB: number;
}): number {
  const saved =
    typeof window !== "undefined" ? sessionStorage.getItem("clarte-empreinte-step") : null;
  const savedStep = saved != null ? Number(saved) : NaN;
  if (!Number.isNaN(savedStep) && savedStep >= 0 && savedStep < STEPS.length) {
    return savedStep;
  }
  if (footprint.postalCode.length < 5) return 0;
  if (footprint.propertyValue <= 0) return 1;
  if (footprint.incomeA <= 0) return 2;
  if (footprint.incomeB <= 0) return 3;
  return 4;
}

function footprintToDraft(footprint: {
  postalCode: string;
  propertyValue: number;
  mortgageRemaining: number;
  incomeA: number;
  incomeB: number;
}) {
  return {
    postalCode: footprint.postalCode,
    propertyValue: footprint.propertyValue > 0 ? footprint.propertyValue.toLocaleString("fr-FR") : "",
    mortgageRemaining:
      footprint.mortgageRemaining > 0 || footprint.incomeA > 0
        ? footprint.mortgageRemaining.toLocaleString("fr-FR")
        : "",
    incomeA: footprint.incomeA > 0 ? footprint.incomeA.toLocaleString("fr-FR") : "",
    incomeB: footprint.incomeB > 0 ? footprint.incomeB.toLocaleString("fr-FR") : "",
  };
}

async function fetchDvfHint(postalCode: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/dvf?postalCode=${postalCode}&surface=65`);
    if (!res.ok) return null;
    const data = (await res.json()) as { estimate?: number };
    if (!data.estimate) return null;
    return `~${Math.round(data.estimate).toLocaleString("fr-FR")} € dans votre zone`;
  } catch {
    return null;
  }
}

function EmpreinteFlow() {
  const router = useRouter();
  const footprint = useSeparationStore((s) => s.footprint);
  const setFootprintField = useSeparationStore((s) => s.setFootprintField);
  const completeFootprint = useSeparationStore((s) => s.completeFootprint);

  const [step, setStep] = useState(() => inferStep(footprint));
  const [draft, setDraft] = useState(() => footprintToDraft(footprint));
  const [dvfHint, setDvfHint] = useState<string | null>(null);
  const [dvfLoading, setDvfLoading] = useState(false);

  const currentStep = STEPS[step];

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
    if (currentStep.field === "mortgageRemaining") {
      return parseCurrency(raw) >= 0;
    }
    return parseCurrency(raw) > 0;
  };

  const commitStep = () => {
    if (!currentStep || !validateStep()) return;

    if (currentStep.type === "postal") {
      const postalCode = draft.postalCode.replace(/\D/g, "");
      setFootprintField("postalCode", postalCode);
    } else {
      setFootprintField(currentStep.field, parseCurrency(draft[currentStep.field]));
    }

    if (step === STEPS.length - 1) {
      const ok = completeFootprint();
      if (ok) {
        sessionStorage.removeItem("clarte-empreinte-step");
        router.push("/simulation/portes");
      }
      return;
    }

    const nextStep = step + 1;
    sessionStorage.setItem("clarte-empreinte-step", String(nextStep));
    setStep(nextStep);
    setDvfHint(null);

    if (step === 0 && currentStep.type === "postal") {
      const postalCode = draft.postalCode.replace(/\D/g, "");
      setDvfLoading(true);
      void fetchDvfHint(postalCode).then((hint) => {
        setDvfHint(hint);
        setDvfLoading(false);
      });
    }
  };

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
          hint={"hint" in currentStep ? currentStep.hint : undefined}
          whisper={
            step === 1 && dvfLoading
              ? "Estimation locale en cours…"
              : step === 1 && dvfHint
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
