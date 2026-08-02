"use client";

import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import type { DoorId } from "@separation/schemas";
import { clarte } from "@/lib/clarte-design";
import { cn } from "@/lib/utils";
import { useSeparationStore } from "@/store/separation-store";
import { buildAllPortes } from "@/lib/separation/porte-presenter";
import { buildEmpreinteContextLine } from "@/lib/separation/empreinte-context";
import { PorteCard } from "./porte-card";

export function PortesGrid() {
  const router = useRouter();
  const openDoor = useSeparationStore((s) => s.openDoor);
  const footprint = useSeparationStore((s) => s.footprint);
  const lastResult = useSeparationStore((s) => s.derived.lastResult);
  const doorVerdicts = useSeparationStore((s) => s.derived.doorVerdicts);

  const portes = buildAllPortes(lastResult, doorVerdicts, footprint);
  const contextLine = buildEmpreinteContextLine(footprint);

  const handleOpen = (doorId: DoorId) => {
    openDoor(doorId);
    router.push(`/simulation/laboratoire/${doorId}`);
  };

  if (portes.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200/80" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-10 text-center md:mb-14">
        <p className="text-sm font-medium tracking-wide text-slate-400">Vos options</p>
        <h1 className="mt-3 text-2xl font-light tracking-tight text-slate-900 md:text-3xl">
          Cinq chemins possibles
        </h1>
        {contextLine && (
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-500">
            {contextLine}
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        {portes.map((porte) => (
          <PorteCard key={porte.doorId} porte={porte} onOpen={handleOpen} />
        ))}
      </div>
    </div>
  );
}

export function PortesShell() {
  const router = useRouter();
  const reopenEmpreinte = useSeparationStore((s) => s.reopenEmpreinte);

  const handleEditInfo = () => {
    // Conserve toutes les données — rouvre le wizard à l'étape 1.
    reopenEmpreinte();
    router.push("/simulation");
  };

  return (
    <div className={`${clarte.mesh} min-h-[100dvh] px-4 py-16 md:px-8 md:py-20`}>
      <div className="mx-auto mb-2 flex w-full max-w-4xl justify-end md:mb-4">
        <button
          type="button"
          onClick={handleEditInfo}
          className={cn(
            clarte.btnGhost,
            "inline-flex items-center gap-1.5 px-3 py-2 text-xs text-slate-500 underline-offset-4 hover:underline md:text-sm"
          )}
        >
          <Pencil className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          Modifier mes informations
        </button>
      </div>
      <PortesGrid />
    </div>
  );
}
