"use client";

import { useMemo, useState } from "react";
import { clarte } from "@/lib/clarte-design";
import { cn } from "@/lib/utils";
import type { ExpertExportPack } from "@/lib/separation/export-bilan-model";
import { ExportBilanDocument } from "./export-bilan-document";
import styles from "./export-bilan.module.css";

interface ShareBilanShellProps {
  pack: ExpertExportPack;
  senderLabel?: string;
}

function fieldValue(pack: ExpertExportPack, label: string): string | undefined {
  return pack.footprint.find((f) => f.label === label)?.value;
}

export function ShareBilanShell({ pack, senderLabel }: ShareBilanShellProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const activeChapter = useMemo(() => {
    const active = pack.activeDoorId;
    return pack.chapters.find((c) => c.doorId === active) ?? pack.chapters[0] ?? null;
  }, [pack]);

  const downloadExpertPdf = async () => {
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
      a.download = "clarte-bilan-partage.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError("Impossible de générer le PDF. Réessayez dans un instant.");
    } finally {
      setDownloading(false);
    }
  };

  if (!activeChapter) {
    return (
      <div className={`${clarte.mesh} flex min-h-[100dvh] items-center justify-center`}>
        <p className="text-sm text-slate-500">Bilan introuvable.</p>
      </div>
    );
  }

  const whoRaw = senderLabel?.trim() || "votre partenaire";
  const who =
    whoRaw === "Votre partenaire" ? "votre partenaire" : whoRaw;
  const postal = fieldValue(pack, "Code postal");
  const value = fieldValue(pack, "Valeur du bien");

  const metaLine = ["Partagé par " + who, pack.dateLabel, value, postal]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={`${clarte.mesh} flex min-h-[100dvh] flex-col`}>
      <header
        className={cn(
          "shrink-0 border-b border-slate-200/60 bg-white/50 px-4 py-3 backdrop-blur-sm md:px-8",
          styles.noPrint
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-600">Clarté</p>
          <button
            type="button"
            onClick={() => void downloadExpertPdf()}
            disabled={downloading}
            className={cn(clarte.btnPrimary, "px-4 py-2 text-xs sm:text-sm")}
          >
            {downloading ? "PDF…" : "Garder en PDF"}
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 lg:px-8 lg:py-8">
        <div className={cn(styles.page, "mx-auto max-w-3xl")}>
          <ExportBilanDocument
            chapter={activeChapter}
            hideBrandMark
            metaLine={metaLine}
            onPrint={() => window.print()}
            downloadError={downloadError}
          />
        </div>
      </div>
    </div>
  );
}
