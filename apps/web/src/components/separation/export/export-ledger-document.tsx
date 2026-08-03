"use client";

import { cn, formatEuro } from "@/lib/utils";
import type { LabLedgerModel, LedgerLine } from "@/lib/separation/lab-ledger-model";
import {
  groupLedgerLines,
  resolveLedgerSectionMeta,
  type LedgerSectionId,
} from "@/lib/separation/lab-ledger-sections";
import type { DoorId } from "@separation/schemas";
import {
  debtThresholdMessage,
  formatVerdictLabel,
  HCSF_DEBT_CEILING_PCT,
  parseFooterBlocks,
} from "@/lib/separation/lab-ledger-insights";
import styles from "./export-bilan.module.css";

const TONE_CLASS: Record<NonNullable<LedgerLine["tone"]>, string> = {
  neutral: styles.ledgerToneNeutral,
  subtract: styles.ledgerToneSubtract,
  highlight: styles.ledgerToneHighlight,
  total: styles.ledgerToneTotal,
};

function ExportLedgerRow({ line }: { line: LedgerLine }) {
  const prefix = line.tone === "subtract" ? "−" : "";
  const tone = line.tone ?? "neutral";

  return (
    <div className={cn(styles.ledgerRow, line.tone === "total" && styles.ledgerRowTotal, TONE_CLASS[tone])}>
      <div className={styles.ledgerLabelBlock}>
        <span>{line.label}</span>
        {line.hint && <span className={styles.ledgerHint}>{line.hint}</span>}
      </div>
      <span className={styles.ledgerAmount}>
        {prefix}
        {formatEuro(line.amount)}
        {line.suffix ?? ""}
      </span>
    </div>
  );
}

function ExportLedgerSection({
  sectionId,
  lines,
  doorId,
}: {
  sectionId: LedgerSectionId;
  lines: LedgerLine[];
  doorId: DoorId;
}) {
  const meta = resolveLedgerSectionMeta(sectionId, doorId);

  return (
    <div className={cn(styles.ledgerSection, styles[`ledgerSection_${sectionId}`])}>
      <p className={styles.ledgerSectionTitle}>{meta.title}</p>
      <p className={styles.ledgerSectionSubtitle}>{meta.subtitle}</p>
      {lines.map((line) => (
        <ExportLedgerRow key={line.id} line={line} />
      ))}
    </div>
  );
}

export function ExportLedgerDocument({ ledger }: { ledger: LabLedgerModel }) {
  const groups = groupLedgerLines(ledger.lines);
  const voiceDoorId = ledger.sectionVoiceDoorId ?? ledger.doorId;
  const parsed = ledger.footer ? parseFooterBlocks(ledger.footer) : null;
  const debtThreshold =
    parsed?.debtPct != null
      ? debtThresholdMessage(parsed.debtPct, voiceDoorId)
      : undefined;

  return (
    <>
      {ledger.verdict && (
        <p className={cn(styles.verdictBanner, styles[`verdict_${ledger.verdict.verdict}`])}>
          {formatVerdictLabel(ledger.verdict.verdict)} — {ledger.verdict.headline}
        </p>
      )}

      {groups.map((group) => (
        <ExportLedgerSection
          key={group.sectionId}
          sectionId={group.sectionId}
          lines={group.lines}
          doorId={voiceDoorId}
        />
      ))}

      {(ledger.footer || ledger.contextNote || ledger.warningNote) && (
        <div className={styles.insightsBox}>
          <p className={styles.insightsTitle}>Ce que ça signifie</p>

          {parsed?.negativeEquityLine && (
            <p className={styles.insightAlert}>{parsed.negativeEquityLine}</p>
          )}

          {parsed?.debtLine && (
            <div className={styles.insightDebt}>
              <p className={styles.insightDebtPct}>
                {parsed.debtPct != null ? `${parsed.debtPct} %` : "—"}
              </p>
              <p>{parsed.debtLine}</p>
              {debtThreshold && <p className={styles.insightEmphasis}>{debtThreshold}</p>}
              <p className={styles.insightMuted}>
                Calcul : mensualités totales ÷ revenus nets mensuels (plafond HCSF{" "}
                {HCSF_DEBT_CEILING_PCT} %).
              </p>
            </div>
          )}

          {parsed?.relocateLine && <p className={styles.insightBody}>{parsed.relocateLine}</p>}

          {parsed?.otherLines.map((line, index) => (
            <p key={`export-insight-${index}`} className={styles.insightBody}>
              {line}
            </p>
          ))}

          {ledger.contextNote && (
            <p className={cn(styles.insightEmphasis, styles[`verdictText_${ledger.verdict?.verdict ?? "neutral"}`])}>
              {ledger.contextNote}
            </p>
          )}

          {ledger.warningNote && (
            <p className={styles.insightWarning}>
              <strong>Banque : </strong>
              {ledger.warningNote}
            </p>
          )}
        </div>
      )}
    </>
  );
}
