"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { clarte } from "@/lib/clarte-design";
import { cn } from "@/lib/utils";
import { useSeparationStore } from "@/store/separation-store";
import { buildExportBilan } from "@/lib/separation/export-bilan-model";
import { ExportLedgerDocument } from "./export-ledger-document";
import styles from "./export-bilan.module.css";

export function ExportBilanShell() {
  const router = useRouter();
  const footprint = useSeparationStore((s) => s.footprint);
  const assumptions = useSeparationStore((s) => s.assumptions);
  const lab = useSeparationStore((s) => s.lab);
  const lastResult = useSeparationStore((s) => s.derived.lastResult);
  const doorVerdicts = useSeparationStore((s) => s.derived.doorVerdicts);

  const model = useMemo(() => {
    if (!lab.activeDoor) return null;
    return buildExportBilan({
      doorId: lab.activeDoor,
      footprint,
      assumptions,
      lab,
      result: lastResult,
      doorVerdicts,
    });
  }, [footprint, assumptions, lab, lastResult, doorVerdicts]);

  if (!model) {
    return (
      <div className={styles.page}>
        <div className={styles.document}>
          <p className="text-sm text-slate-500">Préparation du document…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.document}>
        <header className={styles.header}>
          <h1 className={styles.title}>{model.scenarioTitle}</h1>
          <p className={styles.date}>{model.dateLabel}</p>
        </header>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Situation initiale</h2>
          {model.footprint.map((field) => (
            <div key={field.label} className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{field.label}</span>
              <span className={styles.fieldValue}>{field.value}</span>
            </div>
          ))}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Vos ajustements</h2>
          {model.activeLevers.length === 0 ? (
            <p className={styles.emptyLevers}>Aucun ajustement — on part des hypothèses standard.</p>
          ) : (
            model.activeLevers.map((lever) => (
              <div key={lever.id} className={styles.leverRow}>
                <span className={styles.leverLabel}>{lever.label}</span>
                <span className={styles.leverValue}>{lever.value}</span>
              </div>
            ))
          )}
        </section>

        {model.insights.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Points d'attention</h2>
            {model.insights.map((insight) => (
              <div key={insight.title} className={styles.insightBlock}>
                <p className={styles.insightTitle}>{insight.title}</p>
                <p className={styles.insightBody}>{insight.body}</p>
              </div>
            ))}
          </section>
        )}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Ce que ça donne</h2>
          <ExportLedgerDocument ledger={model.ledger} />
        </section>

        <p className={styles.disclaimer}>{model.disclaimer}</p>

        <div className={cn(styles.actions, styles.noPrint)}>
          <button
            type="button"
            onClick={() => window.print()}
            className={cn(clarte.btnPrimary, "px-6 py-3 text-sm")}
          >
            Imprimer / Sauvegarder en PDF
          </button>
          <button
            type="button"
            onClick={() => router.push(`/simulation/laboratoire/${lab.activeDoor}`)}
            className={cn(clarte.btnGhost, "px-6 py-3 text-sm")}
          >
            ← Retour au scénario
          </button>
        </div>
      </div>
    </div>
  );
}
