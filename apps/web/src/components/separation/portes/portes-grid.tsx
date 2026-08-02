"use client";

import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { DoorId } from "@separation/schemas";
import { clarte } from "@/lib/clarte-design";
import { cn } from "@/lib/utils";
import { duration, ease, staggerContainer, staggerItem } from "@/lib/motion";
import { useSeparationStore } from "@/store/separation-store";
import {
  buildAllPortes,
  groupPortes,
  pickFeaturedDoorId,
} from "@/lib/separation/porte-presenter";
import { buildEmpreinteContextLine } from "@/lib/separation/empreinte-context";
import { PorteCard } from "./porte-card";
import { useMarketBuySync } from "@/lib/market/use-market-buy-sync";

export function PortesGrid() {
  const router = useRouter();
  const reduced = useReducedMotion();
  useMarketBuySync();
  const openDoor = useSeparationStore((s) => s.openDoor);
  const footprint = useSeparationStore((s) => s.footprint);
  const lastResult = useSeparationStore((s) => s.derived.lastResult);
  const doorVerdicts = useSeparationStore((s) => s.derived.doorVerdicts);

  const portes = buildAllPortes(lastResult, doorVerdicts, footprint);
  const featuredId = pickFeaturedDoorId(portes);
  const featured = portes.find((p) => p.doorId === featuredId) ?? null;
  const groups = groupPortes(portes, { excludeDoorId: featuredId });
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
      <header className="mb-10 text-center md:mb-12">
        <p className="text-sm font-medium tracking-wide text-slate-400">Après l&apos;empreinte</p>
        <h1 className="mt-3 text-2xl font-light tracking-tight text-slate-900 md:text-3xl">
          Choisissez un chemin
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
          Trois façons de sortir de l&apos;indivision — cinq variantes selon qui reste, vend ou
          loue.
        </p>
        {contextLine && (
          <p className="mx-auto mt-4 max-w-lg text-xs leading-relaxed text-slate-400">
            {contextLine}
          </p>
        )}
      </header>

      {featured && (
        <motion.section
          className="mb-12 md:mb-14"
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.normal, ease: ease.out }}
        >
          <PorteCard porte={featured} onOpen={handleOpen} featured />
        </motion.section>
      )}

      <motion.div
        className="space-y-12 md:space-y-14"
        variants={reduced ? undefined : staggerContainer}
        initial={reduced ? false : "hidden"}
        animate="show"
      >
        {groups.map(({ group, portes: groupPortesList }) => (
          <motion.section key={group.id} variants={reduced ? undefined : staggerItem}>
            <div className="mb-4 md:mb-5">
              <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-slate-400">
                {group.title}
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">{group.subtitle}</p>
            </div>

            <div
              className={cn(
                "grid grid-cols-1 gap-3 md:gap-4",
                groupPortesList.length > 1 ? "md:grid-cols-2" : "md:grid-cols-1"
              )}
            >
              {groupPortesList.map((porte) => (
                <PorteCard key={porte.doorId} porte={porte} onOpen={handleOpen} />
              ))}
            </div>
          </motion.section>
        ))}
      </motion.div>
    </div>
  );
}

export function PortesShell() {
  const router = useRouter();
  const reopenEmpreinte = useSeparationStore((s) => s.reopenEmpreinte);

  const handleEditInfo = () => {
    reopenEmpreinte();
    router.push("/simulation");
  };

  return (
    <div className={`${clarte.mesh} min-h-[100dvh] px-4 py-14 md:px-8 md:py-20`}>
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
