"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clarte } from "@/lib/clarte-design";
import { useSeparationStore } from "@/store/separation-store";
import { useSeparationHydrated } from "@/lib/separation/use-separation-hydrated";
import { PortesShell } from "@/components/separation/portes/portes-grid";

export default function PortesPage() {
  const router = useRouter();
  const footprint = useSeparationStore((s) => s.footprint);
  const hydrated = useSeparationHydrated();

  useEffect(() => {
    if (!hydrated) return;
    if (!footprint.completedAt) {
      router.replace("/simulation");
    }
  }, [hydrated, footprint.completedAt, router]);

  if (!hydrated || !footprint.completedAt) {
    return (
      <div className={`${clarte.mesh} flex min-h-[100dvh] items-center justify-center`}>
        <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200/80" />
      </div>
    );
  }

  return <PortesShell />;
}
