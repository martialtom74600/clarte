"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clarte } from "@/lib/clarte-design";
import { useSeparationStore } from "@/store/separation-store";
import { useSeparationHydrated } from "@/lib/separation/use-separation-hydrated";
import { ExportBilanShell } from "@/components/separation/export/export-bilan-shell";

export default function ExportBilanPage() {
  const router = useRouter();
  const footprint = useSeparationStore((s) => s.footprint);
  const activeDoor = useSeparationStore((s) => s.lab.activeDoor);
  const hydrated = useSeparationHydrated();

  useEffect(() => {
    if (!hydrated) return;
    if (!footprint?.completedAt) {
      router.replace("/simulation");
      return;
    }
    if (!activeDoor) {
      router.replace("/simulation/portes");
    }
  }, [hydrated, footprint?.completedAt, activeDoor, router]);

  if (!hydrated || !footprint?.completedAt || !activeDoor) {
    return (
      <div className={`${clarte.mesh} flex min-h-[100dvh] items-center justify-center`}>
        <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200/80" />
      </div>
    );
  }

  return <ExportBilanShell />;
}
