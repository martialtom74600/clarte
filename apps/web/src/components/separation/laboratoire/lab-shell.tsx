"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { DoorId } from "@separation/schemas";
import { clarte } from "@/lib/clarte-design";
import { useSeparationStore } from "@/store/separation-store";
import { buildLabLedger } from "@/lib/separation/lab-ledger-model";
import { LabLedger } from "./lab-ledger";
import { LabLeversPanel } from "./lab-levers-panel";

interface LabShellProps {
  doorId: DoorId;
}

export function LabShell({ doorId }: LabShellProps) {
  const router = useRouter();
  const footprint = useSeparationStore((s) => s.footprint);
  const assumptions = useSeparationStore((s) => s.assumptions);
  const lab = useSeparationStore((s) => s.lab);
  const lastResult = useSeparationStore((s) => s.derived.lastResult);
  const doorVerdicts = useSeparationStore((s) => s.derived.doorVerdicts);
  const closeLab = useSeparationStore((s) => s.closeLab);

  const ledger = useMemo(
    () =>
      buildLabLedger({
        doorId,
        footprint,
        assumptions,
        lab,
        result: lastResult,
        doorVerdicts,
      }),
    [doorId, footprint, assumptions, lab, lastResult, doorVerdicts]
  );

  return (
    <div className={`${clarte.mesh} min-h-[100dvh]`}>
      <header className="border-b border-slate-200/60 bg-white/40 px-4 py-4 backdrop-blur-sm md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              closeLab();
              router.push("/simulation/portes");
            }}
            className="text-sm font-medium text-slate-500 transition-colors hover:text-brand-600"
          >
            ← Portes
          </button>
          <p className="text-sm text-slate-400">Affinez votre scénario</p>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col lg:grid lg:min-h-[calc(100dvh-65px)] lg:grid-cols-2 lg:gap-0">
        <aside className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/85 px-6 py-8 backdrop-blur-md lg:static lg:border-b-0 lg:border-r lg:bg-transparent lg:px-10 lg:py-12">
          <LabLedger model={ledger} />
        </aside>

        <main className="px-6 py-8 lg:overflow-y-auto lg:px-10 lg:py-12">
          <LabLeversPanel doorId={doorId} />
        </main>
      </div>
    </div>
  );
}
