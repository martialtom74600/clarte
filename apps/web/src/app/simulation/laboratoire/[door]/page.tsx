"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { clarte } from "@/lib/clarte-design";
import { useSeparationStore } from "@/store/separation-store";
import { useSeparationHydrated } from "@/lib/separation/use-separation-hydrated";
import { isValidDoorId } from "@/lib/separation/porte-presenter";
import { LabShell } from "@/components/separation/laboratoire/lab-shell";

export default function LaboratoirePage() {
  const router = useRouter();
  const params = useParams();
  const door = typeof params.door === "string" ? params.door : "";
  const footprint = useSeparationStore((s) => s.footprint);
  const activeDoor = useSeparationStore((s) => s.lab.activeDoor);
  const openDoor = useSeparationStore((s) => s.openDoor);
  const hydrated = useSeparationHydrated();

  useEffect(() => {
    if (!hydrated) return;
    if (!footprint.completedAt) {
      router.replace("/simulation");
      return;
    }
    if (!isValidDoorId(door)) {
      router.replace("/simulation/portes");
      return;
    }
    if (activeDoor !== door) {
      openDoor(door);
    }
  }, [hydrated, footprint.completedAt, door, router, activeDoor, openDoor]);

  if (!hydrated || !footprint.completedAt || !isValidDoorId(door)) {
    return (
      <div className={`${clarte.mesh} flex min-h-[100dvh] items-center justify-center`}>
        <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200/80" />
      </div>
    );
  }

  return <LabShell doorId={door} />;
}
