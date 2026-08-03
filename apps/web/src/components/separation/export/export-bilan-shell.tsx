"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clarte } from "@/lib/clarte-design";
import { cn } from "@/lib/utils";
import { useSeparationStore } from "@/store/separation-store";
import { buildExpertExportPack } from "@/lib/separation/export-bilan-model";
import { buildEmpreinteContextLine } from "@/lib/separation/empreinte-context";
import { ExportActionDock } from "./export-action-dock";
import { ExportBilanDocument } from "./export-bilan-document";
import styles from "./export-bilan.module.css";

export function ExportBilanShell() {
  const router = useRouter();
  const footprint = useSeparationStore((s) => s.footprint);
  const assumptions = useSeparationStore((s) => s.assumptions);
  const lab = useSeparationStore((s) => s.lab);
  const lastResult = useSeparationStore((s) => s.derived.lastResult);
  const doorVerdicts = useSeparationStore((s) => s.derived.doorVerdicts);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const pack = useMemo(() => {
    if (!footprint || !assumptions || !lab) return null;
    return buildExpertExportPack({
      footprint,
      assumptions,
      lab,
      result: lastResult,
      doorVerdicts,
    });
  }, [footprint, assumptions, lab, lastResult, doorVerdicts]);

  const activeChapter = useMemo(() => {
    if (!pack) return null;
    const active = lab.activeDoor;
    return (
      pack.chapters.find((c) => c.doorId === active) ?? pack.chapters[0] ?? null
    );
  }, [pack, lab.activeDoor]);

  const contextLine = buildEmpreinteContextLine(footprint);

  const downloadExpertPdf = async () => {
    if (!pack) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack }),
      });
      if (!res.ok) throw new Error(`pdf ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "clarte-bilan-expert.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError("Impossible de générer le PDF. Réessayez dans un instant.");
    } finally {
      setDownloading(false);
    }
  };

  const backToLab = () => {
    const door = lab.activeDoor;
    router.push(door ? `/simulation/laboratoire/${door}` : "/simulation/portes");
  };

  if (!pack || !activeChapter) {
    return (
      <div className={`${clarte.mesh} flex min-h-[100dvh] items-center justify-center`}>
        <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200/80" />
      </div>
    );
  }

  return (
    <div className={`${clarte.mesh} flex min-h-[100dvh] flex-col`}>
      <header
        className={cn(
          "shrink-0 border-b border-slate-200/60 bg-white/50 px-4 py-3 backdrop-blur-sm md:px-8",
          styles.noPrint
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={backToLab}
            className="text-sm font-medium text-slate-500 transition-colors hover:text-brand-600"
          >
            ← Retour
          </button>

          <p className="hidden max-w-md truncate text-center text-sm text-slate-400 sm:block">
            {contextLine || "Bilan de séparation"}
          </p>

          <button
            type="button"
            onClick={() => void downloadExpertPdf()}
            disabled={downloading}
            className={cn(clarte.btnPrimary, "px-4 py-2 text-xs sm:text-sm")}
          >
            {downloading ? "PDF…" : "Télécharger"}
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 lg:px-8 lg:py-8">
        <div className={cn(styles.page, "mx-auto max-w-3xl")}>
          <ExportBilanDocument
            chapter={activeChapter}
            afterHeader={
              lastResult ? (
                <ExportActionDock
                  scenarioTitle={activeChapter.bilan.scenarioTitle}
                  result={lastResult}
                  footprint={footprint}
                  assumptions={assumptions}
                  lab={lab}
                  doorVerdicts={doorVerdicts}
                />
              ) : null
            }
            onPrint={() => window.print()}
            downloadError={downloadError}
          />
        </div>
      </div>
    </div>
  );
}
