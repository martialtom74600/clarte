import type { AffordabilityVerdict, DoorId } from "@separation/schemas";
import { HCSF_MAX_EFFORT_PERCENT } from "@separation/engine";
import type { LabLedgerModel } from "./lab-ledger-model";

export const HCSF_DEBT_CEILING_PCT = HCSF_MAX_EFFORT_PERCENT;

export function shouldOpenLedgerInsights(verdict: AffordabilityVerdict | undefined): boolean {
  return verdict === "orange" || verdict === "red";
}

/** Réécrit le détail keep pour la personne qui lit l'app (empreinte = personne A). */
export function normalizeKeepFooterDetail(detail: string, doorId: "keep_a" | "keep_b"): string {
  if (doorId !== "keep_b") return detail;
  return detail
    .replace(/Votre endettement sera/gi, "L'endettement de l'autre sera")
    .replace(/-> Projet finançable/g, "-> Projet finançable pour l'autre")
    .replace(/-> Projet qui dépasse/g, "-> Projet qui dépasse pour l'autre");
}

export function debtThresholdMessage(
  debtPct: number | null,
  doorId: DoorId
): string | undefined {
  if (debtPct == null || debtPct <= HCSF_DEBT_CEILING_PCT) return undefined;
  const subject =
    doorId === "keep_b" ? "L'endettement de l'autre" : "Votre taux d'endettement";
  return `${subject} (${debtPct} %) dépasse le plafond légal de ${HCSF_DEBT_CEILING_PCT} %.`;
}

export function parseFooterBlocks(footer: string) {
  const lines = footer.split("\n").map((l) => l.trim()).filter(Boolean);
  const debtLine = lines.find((l) => /endettement sera de \d+ %/i.test(l));
  const debtMatch = debtLine?.match(/endettement sera de (\d+) %/i);
  const relocateLine = lines.find(
    (l) => l.startsWith("Partant :") || l.startsWith("Relogement dans le quartier")
  );
  const negativeEquityLine = lines.find(
    (l) =>
      l.includes("Actif net négatif") ||
      l.includes("dette à partager") ||
      l.includes("Dette résiduelle")
  );
  const otherLines = lines.filter(
    (l) =>
      l !== debtLine &&
      l !== relocateLine &&
      l !== negativeEquityLine &&
      !l.includes("désolidarisation") &&
      !l.startsWith("Produit net partagé") &&
      !l.startsWith("Cible relogement") &&
      !l.startsWith("->")
  );

  return {
    debtLine,
    debtPct: debtMatch ? Number(debtMatch[1]) : null,
    relocateLine,
    negativeEquityLine,
    otherLines,
  };
}

export function formatVerdictLabel(verdict: AffordabilityVerdict): string {
  return verdict === "green" ? "Tenable" : verdict === "orange" ? "Serré" : "Difficile";
}

export function stripBankDisclaimer(text: string, disclaimer?: string): string {
  if (!disclaimer || !text.includes(disclaimer)) return text.trim();
  return text.replace(disclaimer, "").replace(/\s{2,}/g, " ").trim();
}

export function buildLedgerInsightSummary(ledger: LabLedgerModel): string[] {
  const lines: string[] = [];
  if (ledger.contextNote) lines.push(ledger.contextNote);
  if (ledger.footer) {
    const parsed = parseFooterBlocks(ledger.footer);
    if (parsed.negativeEquityLine) lines.push(parsed.negativeEquityLine);
    if (parsed.relocateLine) lines.push(parsed.relocateLine);
    lines.push(...parsed.otherLines);
  }
  return lines;
}
