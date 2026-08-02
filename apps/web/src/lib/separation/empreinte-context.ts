import type { RelationshipStatus } from "@separation/schemas";
import type { FootprintState } from "./separation-types";

const STATUS_LABELS: Record<RelationshipStatus, string> = {
  marriage: "Mariés",
  pacs: "PACS",
  concubinage: "Union libre",
};

/** Parts A/B (0–100) depuis l'empreinte ou défaut 50/50. */
export function resolveOwnershipPercents(footprint: FootprintState): {
  shareA: number;
  shareB: number;
} {
  if (
    footprint.cadreJuridiqueDeclared &&
    footprint.ownershipShareA > 0 &&
    footprint.ownershipShareB > 0
  ) {
    return {
      shareA: footprint.ownershipShareA,
      shareB: footprint.ownershipShareB,
    };
  }
  return { shareA: 50, shareB: 50 };
}

export function legalStatusLabel(status: RelationshipStatus | ""): string | null {
  if (status === "marriage" || status === "pacs" || status === "concubinage") {
    return STATUS_LABELS[status];
  }
  return null;
}

/** Bandeau / sous-titre Portes & Lab : « Union libre · Vous 60 % · Autre 40 % ». */
export function buildEmpreinteContextLine(footprint: FootprintState): string {
  const parts: string[] = [];
  const status = legalStatusLabel(footprint.legalStatus);
  if (status) parts.push(status);

  const { shareA, shareB } = resolveOwnershipPercents(footprint);
  parts.push(`Vous ${shareA} % · Autre ${shareB} %`);

  if (footprint.contributionA > 0 || footprint.contributionB > 0) {
    parts.push("Apports inclus");
  }
  if (footprint.financementDeclared && footprint.mortgageRemaining === 0) {
    parts.push("Sans crédit");
  }

  return parts.join(" · ");
}

export function ownershipCaption(person: "A" | "B", footprint: FootprintState): string {
  const { shareA, shareB } = resolveOwnershipPercents(footprint);
  const pct = person === "A" ? shareA : shareB;
  return `part ${pct} %`;
}
