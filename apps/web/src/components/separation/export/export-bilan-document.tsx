"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { clarte } from "@/lib/clarte-design";
import type { ExportDoorChapter } from "@/lib/separation/export-bilan-model";
import { ExportLedgerDocument } from "./export-ledger-document";
import styles from "./export-bilan.module.css";

interface ExportBilanDocumentProps {
  chapter: ExportDoorChapter;
  /** Sous-titre sous le titre (date, contexte…). */
  metaLine?: ReactNode;
  /** Contenu entre le titre et les chiffres (ex. dock CTA). */
  afterHeader?: ReactNode;
  hideHeader?: boolean;
  /** Masque le marque « Clarté » du document (ex. déjà dans le chrome page). */
  hideBrandMark?: boolean;
  onPrint?: () => void;
  downloadError?: string | null;
  className?: string;
}

/** Corps du bilan (chiffres → récit → suite → hypothèses) — partagé export / partage. */
export function ExportBilanDocument({
  chapter,
  metaLine,
  afterHeader,
  hideHeader,
  hideBrandMark,
  onPrint,
  downloadError,
  className,
}: ExportBilanDocumentProps) {
  const model = chapter.bilan;

  return (
    <div className={cn(styles.document, className)}>
      {!hideHeader && (
        <header className={styles.header}>
          {!hideBrandMark && <p className={styles.brandMark}>Clarté</p>}
          <h1 className={styles.title}>{model.scenarioTitle}</h1>
          <p className={styles.date}>
            {metaLine ?? (
              <>
                {model.dateLabel}
                <span className={styles.dateSep}>·</span>
                Bilan expert — 5 portes
              </>
            )}
          </p>
        </header>
      )}

      {afterHeader}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Ce que ça donne</h2>
        <ExportLedgerDocument ledger={model.ledger} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Comment ça marche</h2>
        {chapter.howItWorks.map((block) => (
          <div key={block.title} className={styles.narrativeBlock}>
            <p className={styles.narrativeTitle}>{block.title}</p>
            <p className={styles.narrativeBody}>{block.body}</p>
          </div>
        ))}
      </section>

      {model.insights.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Points d&apos;attention</h2>
          {model.insights.map((insight) => (
            <div key={insight.title} className={styles.insightBlock}>
              <p className={styles.insightTitle}>{insight.title}</p>
              <p className={styles.insightBody}>{insight.body}</p>
            </div>
          ))}
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Et ensuite</h2>
        <ol className={styles.nextSteps}>
          {chapter.nextSteps.map((step, index) => (
            <li key={step} className={styles.nextStepItem}>
              <span className={styles.nextStepIndex} aria-hidden>
                {index + 1}
              </span>
              <span className={styles.nextStepText}>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <details className={styles.hypotheses}>
        <summary className={styles.hypothesesSummary}>Voir les hypothèses du calcul</summary>
        <div className={styles.hypothesesBody}>
          <div className={styles.hypothesesBlock}>
            <h3 className={styles.hypothesesHeading}>Situation initiale</h3>
            {model.footprint.map((field) => (
              <div key={field.label} className={styles.fieldRow}>
                <span className={styles.fieldLabel}>{field.label}</span>
                <span className={styles.fieldValue}>{field.value}</span>
              </div>
            ))}
          </div>
          <div className={styles.hypothesesBlock}>
            <h3 className={styles.hypothesesHeading}>Vos ajustements</h3>
            {model.activeLevers.length === 0 ? (
              <p className={styles.emptyLevers}>
                Rien d&apos;ajusté — on part des hypothèses standard.
              </p>
            ) : (
              model.activeLevers.map((lever) => (
                <div key={lever.id} className={styles.leverRow}>
                  <span className={styles.leverLabel}>{lever.label}</span>
                  <span className={styles.leverValue}>{lever.value}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </details>

      <p className={styles.disclaimer}>{model.disclaimer}</p>

      {(onPrint || downloadError) && (
        <div className={cn(styles.actions, styles.noPrint)}>
          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className={cn(clarte.btnGhost, "px-5 py-2.5 text-sm")}
            >
              Imprimer cette porte
            </button>
          )}
          {downloadError && (
            <p className="w-full text-center text-xs text-red-500">{downloadError}</p>
          )}
        </div>
      )}
    </div>
  );
}
