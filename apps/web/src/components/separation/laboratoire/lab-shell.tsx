"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { DoorId } from "@separation/schemas";
import { clarte } from "@/lib/clarte-design";
import { cn } from "@/lib/utils";
import { useSeparationStore } from "@/store/separation-store";
import { buildLabLedger } from "@/lib/separation/lab-ledger-model";
import { buildEmpreinteContextLine } from "@/lib/separation/empreinte-context";
import { LabLedgerDetails, LabLedgerSummary } from "./lab-ledger";
import { LabLeversPanel } from "./lab-levers-panel";
import { useMarketBuySync } from "@/lib/market/use-market-buy-sync";

interface LabShellProps {
  doorId: DoorId;
}

type MobilePanel = "calcul" | "ajuster";

export function LabShell({ doorId }: LabShellProps) {
  const router = useRouter();
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("ajuster");
  useMarketBuySync();
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
  const contextLine = buildEmpreinteContextLine(footprint);

  return (
    <div className={`${clarte.mesh} flex h-[100dvh] flex-col overflow-hidden`}>
      <header className="shrink-0 border-b border-slate-200/60 bg-white/50 px-4 py-3 backdrop-blur-sm md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
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

          <p className="hidden max-w-md truncate text-center text-sm text-slate-400 sm:block">
            {contextLine || "Affinez votre scénario"}
          </p>

          <button
            type="button"
            onClick={() => router.push("/simulation/export")}
            className={cn(clarte.btnPrimary, "px-4 py-2 text-xs sm:text-sm")}
          >
            Exporter
          </button>
        </div>

        <div className="mx-auto mt-3 flex max-w-6xl gap-1 rounded-full bg-slate-100/90 p-1 lg:hidden">
          {(
            [
              { id: "calcul" as const, label: "Calcul" },
              { id: "ajuster" as const, label: "Ajuster" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMobilePanel(tab.id)}
              className={cn(
                "flex-1 rounded-full py-2 text-sm font-medium transition-colors",
                mobilePanel === tab.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 lg:grid-cols-2">
        <aside
          className={cn(
            "flex min-h-0 flex-col border-slate-200/80 bg-white/40 lg:border-r",
            mobilePanel === "calcul" ? "flex" : "hidden lg:flex"
          )}
        >
          <LabLedgerSummary model={ledger} className="shrink-0 border-b border-slate-200/60 px-5 py-4 lg:px-8" />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 lg:px-8 lg:py-5">
            <LabLedgerDetails model={ledger} />
          </div>
        </aside>

        <main
          className={cn(
            "min-h-0 overflow-y-auto overscroll-contain px-5 py-6 lg:px-8 lg:py-8",
            mobilePanel === "ajuster" ? "block" : "hidden lg:block"
          )}
        >
          <LabLeversPanel doorId={doorId} />
        </main>
      </div>
    </div>
  );
}
