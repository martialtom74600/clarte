import type { DoorId, DoorVerdictMap, SimulationResult } from "@separation/schemas";
import {
  buildExpertExportPack,
  type ExpertExportPack,
  type ExportDoorChapter,
  type ExportField,
  type ExportInsight,
} from "./export-bilan-model";
import type { ExportNarrativeBlock } from "./export-door-narrative";
import type {
  AssumptionsState,
  FootprintState,
  LabState,
} from "./separation-types";
import type { LabLedgerModel, LedgerLine } from "./lab-ledger-model";

/**
 * Pack pour le destinataire : même réalité économique (qui rachète reste qui rachète),
 * mais formulé pour que « vous » = le lecteur et « l'autre » = l'expéditeur.
 */
export function buildRecipientFacingPack(params: {
  footprint: FootprintState;
  assumptions: AssumptionsState;
  lab: LabState;
  result: SimulationResult | null;
  doorVerdicts: DoorVerdictMap | null;
}): ExpertExportPack | null {
  const pack = buildExpertExportPack(params);
  if (!pack) return null;
  return toCounterpartVoicePack(pack);
}

/** Transforme un pack expéditeur → voix destinataire (sans changer qui paie quoi). */
export function toCounterpartVoicePack(pack: ExpertExportPack): ExpertExportPack {
  return {
    ...pack,
    footprint: invertFootprintFields(pack.footprint),
    activeLevers: pack.activeLevers.map((l) => ({
      ...l,
      label: swapPersonWords(l.label),
      value: swapPersonWords(l.value),
    })),
    matrix: pack.matrix.map((row) => ({
      ...row,
      title: counterpartDoorTitle(row.doorId, row.title),
      cashLabel: swapPersonWords(row.cashLabel),
      monthlyLabel: swapPersonWords(row.monthlyLabel),
      relocateLabel: swapPersonWords(row.relocateLabel),
    })),
    chapters: pack.chapters.map(toCounterpartChapter),
  };
}

function toCounterpartChapter(chapter: ExportDoorChapter): ExportDoorChapter {
  return {
    ...chapter,
    title: counterpartDoorTitle(chapter.doorId, chapter.title),
    verdict: chapter.verdict
      ? {
          ...chapter.verdict,
          headline: swapPersonWords(chapter.verdict.headline),
          detail: swapPersonWords(chapter.verdict.detail),
        }
      : null,
    howItWorks: counterpartHowItWorks(chapter.doorId, chapter.howItWorks),
    nextSteps: counterpartNextSteps(chapter.doorId, chapter.nextSteps),
    bilan: {
      ...chapter.bilan,
      scenarioTitle: counterpartDoorTitle(chapter.doorId, chapter.bilan.scenarioTitle),
      footprint: invertFootprintFields(chapter.bilan.footprint),
      activeLevers: chapter.bilan.activeLevers.map((l) => ({
        ...l,
        label: swapPersonWords(l.label),
        value: swapPersonWords(l.value),
      })),
      insights: chapter.bilan.insights.map(invertInsight),
      ledger: invertLedger(chapter.bilan.ledger),
      disclaimer: chapter.bilan.disclaimer,
    },
  };
}

export function counterpartDoorTitle(doorId: DoorId, fallback: string): string {
  switch (doorId) {
    case "keep_a":
      return "Projet : l'autre garde le bien";
    case "keep_b":
      return "Projet : garder le bien";
    case "sell":
      return "Projet : vendre pour se reloger";
    case "sell_rent":
      return "Projet : vendre puis louer";
    case "rent_out":
      return "Projet : garder et louer";
    default:
      return swapPersonWords(fallback);
  }
}

function counterpartHowItWorks(
  doorId: DoorId,
  blocks: ExportNarrativeBlock[]
): ExportNarrativeBlock[] {
  if (doorId === "keep_a") {
    return blocks.map((b) => ({
      title: b.title === "Et vos apports ?" ? "Et les apports ?" : b.title,
      body: rewriteKeepAForCounterpart(b.title, b.body),
    }));
  }
  if (doorId === "keep_b") {
    return blocks.map((b) => ({
      title: b.title,
      body: rewriteKeepBForCounterpart(b.title, b.body),
    }));
  }
  return blocks.map((b) => ({
    title: b.title,
    body: swapPersonWords(b.body),
  }));
}

function counterpartNextSteps(doorId: DoorId, steps: string[]): string[] {
  if (doorId === "keep_a") {
    return steps.map((step) => {
      if (/banque/i.test(step) && /crédit|prêt|laisser/i.test(step)) {
        return "L'autre devra vérifier auprès de sa banque si elle accepte de lui laisser le crédit (ou un nouveau prêt) à son seul nom.";
      }
      if (/notaire/i.test(step) || /vente/i.test(step) || /d'accord sur qui reste/i.test(step)) {
        return step;
      }
      return swapPersonWords(step);
    });
  }
  if (doorId === "keep_b") {
    return steps.map((step) => {
      if (/banque/i.test(step)) {
        return "Prenez rendez-vous à la banque pour savoir si elle accepte de vous laisser le crédit (ou un nouveau prêt) à votre seul nom.";
      }
      if (/notaire/i.test(step) || /vente/i.test(step)) {
        return step;
      }
      return swapPersonWords(step);
    });
  }
  return steps.map(swapPersonWords);
}

/** keep_a (expéditeur garde) → destinataire : l'autre garde, vous partez. */
function rewriteKeepAForCounterpart(title: string, body: string): string {
  if (title === "En clair") {
    return (
      "L'autre garde le logement et rachète votre part — comme s'il ou elle vous achetait " +
      "votre part de maison. Il faudra aussi régler les frais de notaire et, en général, " +
      "que la banque accepte de laisser le crédit (ou un nouveau crédit) à son seul nom."
    );
  }
  if (title === "L'argent qui change de mains") {
    // Garde les montants du corps d'origine, reformule le point de vue.
    const soulte = body.match(/soulte[^0-9]*([0-9][\d\s\u202f]*\s*€)/i)?.[1];
    const total = body.match(/compter\s*~?\s*([0-9][\d\s\u202f]*\s*€)/i)?.[1];
    const pocket = body.match(/environ\s+([0-9][\d\s\u202f]*\s*€)\s+en poche/i)?.[1];
    if (soulte) {
      return (
        `On estime la somme due pour votre part (la « soulte ») à ${soulte.trim()}` +
        (total ? `. Avec les frais d'acte, il faut plutôt compter ~${total.trim()} au total.` : ".") +
        (pocket
          ? ` De votre côté, vous repartez avec environ ${pocket.trim()} en poche.`
          : "")
      );
    }
    return (
      "Le montant exact dépend de la valeur du bien, du crédit restant, de vos parts et des apports."
    );
  }
  if (title === "Et vos apports ?") {
    return (
      "Vous n'étiez pas mariés sous le régime de communauté (ou équivalent). Les sommes mises " +
      "en plus au départ sont remboursées en priorité avant le partage — comme une dette entre " +
      "vous (créance d'indivision, art. 815-13). Les parts sur l'acte ne changent pas pour autant."
    );
  }
  if (title === "Au quotidien, après") {
    return (
      "Celle ou celui qui reste paie le crédit chaque mois. " +
      "Vous, de votre côté, devez vous reloger avec le capital reçu."
    );
  }
  return swapPersonWords(body);
}

/** keep_b (expéditeur laisse l'autre garder) → destinataire : vous gardez. */
function rewriteKeepBForCounterpart(title: string, body: string): string {
  if (title === "En clair") {
    return (
      "Vous gardez le logement. Pour ça, vous rachetez la part de l'autre — comme si vous " +
      "lui rachetiez sa part de maison. Il faudra aussi régler les frais de notaire et, " +
      "en général, que la banque accepte de laisser le crédit (ou un nouveau crédit) à votre seul nom."
    );
  }
  return swapPersonWords(body);
}

function invertFootprintFields(fields: ExportField[]): ExportField[] {
  if (!fields?.length) return fields ?? [];
  const youIncome = fields.find((f) => f.label === "Vos revenus nets");
  const otherIncome = fields.find((f) => f.label === "Revenus de l'autre partie");
  return fields.map((field) => {
    if (field.label === "Répartition de la propriété" || field.label === "Apports à l'achat") {
      return { ...field, value: swapVousAutreValue(field.value) };
    }
    if (field.label === "Vos revenus nets" && otherIncome) {
      return { ...field, value: otherIncome.value };
    }
    if (field.label === "Revenus de l'autre partie" && youIncome) {
      return { ...field, value: youIncome.value };
    }
    return field;
  });
}

function invertInsight(insight: ExportInsight): ExportInsight {
  return {
    title: swapPersonWords(insight.title)
      .replace(/Pour la personne qui part/gi, "Pour vous")
      .replace(/Capital du partant/gi, "Le capital que vous récupérez"),
    body: swapPersonWords(insight.body)
      .replace(/Elle repartirait/gi, "Vous repartiriez")
      .replace(/la personne qui part/gi, "vous"),
  };
}

function sectionVoiceFor(doorId: DoorId): DoorId | undefined {
  if (doorId === "keep_a") return "keep_b";
  if (doorId === "keep_b") return "keep_a";
  return undefined;
}

function invertContextNote(doorId: DoorId, note: string | undefined): string | undefined {
  if (!note) return note;
  if (doorId === "keep_a") {
    if (/tenables dans la zone/i.test(note)) {
      return "Le rachat par l'autre et votre relogement restent tenables dans la zone.";
    }
    if (/Projet serré/i.test(note)) {
      return "Projet serré : l'autre doit convaincre la banque, et votre relogement reste juste.";
    }
  }
  if (doorId === "keep_b") {
    if (/tenables dans la zone/i.test(note)) {
      return "Votre rachat et le relogement de l'autre restent tenables dans la zone.";
    }
    if (/Projet serré/i.test(note)) {
      return "Projet serré : convaincre la banque, et le relogement du partant reste juste.";
    }
  }
  return swapPersonWords(note);
}

function invertLedger(ledger: LabLedgerModel): LabLedgerModel {
  return {
    ...ledger,
    doorTitle: counterpartDoorTitle(ledger.doorId, ledger.doorTitle).replace(/^Projet :\s*/i, ""),
    sectionVoiceDoorId: sectionVoiceFor(ledger.doorId),
    lines: ledger.lines.map((line) => invertLedgerLine(line, ledger.doorId)),
    footer: ledger.footer ? swapPersonWords(ledger.footer) : ledger.footer,
    contextNote: invertContextNote(ledger.doorId, ledger.contextNote),
    warningNote: ledger.warningNote ? swapPersonWords(ledger.warningNote) : ledger.warningNote,
    verdict: ledger.verdict
      ? {
          ...ledger.verdict,
          headline: swapPersonWords(ledger.verdict.headline),
          detail: swapPersonWords(ledger.verdict.detail),
        }
      : ledger.verdict,
  };
}

/** Remap ciblé des libellés ledger keep_* (évite le français cassé du swap naïf). */
function invertLedgerLine(line: LedgerLine, doorId: DoorId): LedgerLine {
  if (doorId === "keep_a") {
    const mapped = remapKeepALedgerLine(line);
    if (mapped) return mapped;
  }
  if (doorId === "keep_b") {
    const mapped = remapKeepBLedgerLine(line);
    if (mapped) return mapped;
  }
  return {
    ...line,
    label: swapPersonWords(line.label),
    hint: line.hint ? swapPersonWords(line.hint) : line.hint,
  };
}

function remapKeepALedgerLine(line: LedgerLine): LedgerLine | null {
  switch (line.id) {
    case "soulte":
      return {
        ...line,
        label: line.label
          .replace(
            /Vous payez à l'autre \(sa part (\d+)\s*%\)/i,
            "L'autre vous paie (votre part $1 %)"
          )
          .replace(/Vous payez à l'autre/i, "L'autre vous paie"),
        hint: line.hint
          ? line.hint.replace(
              /Montant pour racheter la part de l'autre \((\d+)\s*%\)/i,
              "Montant pour racheter votre part ($1 %)"
            )
          : line.hint,
      };
    case "occupation-indemnity":
      return {
        ...line,
        hint: "Indemnité que vous recevez pour l'occupation exclusive",
      };
    case "buyout-transfer":
      return {
        ...line,
        label: "Vous récupérez au total",
      };
    case "departure-capital":
      return {
        ...line,
        label: "Votre argent récupéré",
      };
    case "relocate-monthly":
      return {
        ...line,
        label: "Mensualité de relogement (vous)",
        hint: line.hint
          ? line.hint
              .replace(/dans son zone/gi, "dans la zone")
              .replace(/dans votre zone/gi, "dans la zone")
              .replace(/pour un logement solo dans [^.]*/i, "pour votre logement solo dans la zone")
          : line.hint,
      };
    case "relocate-target":
      return {
        ...line,
        label: line.label.replace(/dans votre zone/i, "dans la zone"),
        hint: line.hint,
      };
    case "kept-mortgage":
      return {
        ...line,
        label: "Crédit actuel de l'autre (conservé)",
        hint: "Mensualité du prêt déjà en cours, à la charge de l'autre",
      };
    case "new-loan":
      return {
        ...line,
        label: "Nouveau prêt de l'autre pour le rachat",
      };
    case "new-loan-monthly":
      return {
        ...line,
        label: "Mensualité du nouveau prêt de l'autre",
      };
    case "monthly":
      return {
        ...line,
        label:
          line.suffix === "/mois" && /Total à rembourser/i.test(line.label)
            ? "Total que l'autre rembourse chaque mois"
            : line.label.replace(/^Mensualité estimée$/i, "Mensualité estimée pour l'autre"),
        hint: line.hint,
      };
    case "refinance":
      return {
        ...line,
        label: "Nouveau crédit de l'autre (rachat + dette + frais)",
      };
    default:
      return null;
  }
}

function remapKeepBLedgerLine(line: LedgerLine): LedgerLine | null {
  switch (line.id) {
    case "soulte":
      return {
        ...line,
        label: line.label.replace(
          /Vous recevez de l'autre \(votre part (\d+)\s*%\)/i,
          "Vous payez à l'autre (sa part $1 %)"
        ),
        hint: line.hint
          ? line.hint.replace(
              /Montant pour racheter la part de l'autre \((\d+)\s*%\)/i,
              "Montant pour racheter la part de l'autre ($1 %)"
            )
          : line.hint,
      };
    case "buyout-transfer":
    case "departure-capital":
      return {
        ...line,
        label:
          line.id === "buyout-transfer"
            ? "Montant total à l'autre"
            : "Ce que l'autre repart avec",
      };
    case "relocate-monthly":
      return {
        ...line,
        label: "Mensualité de relogement (l'autre)",
      };
    case "kept-mortgage":
      return {
        ...line,
        label: "Votre crédit actuel (conservé)",
        hint: "Mensualité du prêt déjà en cours",
      };
    case "new-loan":
      return { ...line, label: "Nouveau prêt pour le rachat" };
    case "new-loan-monthly":
      return { ...line, label: "Mensualité de ce nouveau prêt" };
    case "monthly":
      return {
        ...line,
        label: /Total mensuel de l'autre/i.test(line.label)
          ? "Total à rembourser chaque mois"
          : line.label.replace(/pour l'autre/i, "").replace(/\s+/g, " ").trim() ||
            "Mensualité estimée",
      };
    case "refinance":
      return {
        ...line,
        label: "Nouveau crédit (rachat + dette + frais)",
      };
    default:
      return null;
  }
}

function swapVousAutreValue(value: string): string {
  const m = value.match(/Vous\s+(.+?)\s*·\s*Autre\s+(.+)/i);
  if (!m) return value;
  return `Vous ${m[2].trim()} · Autre ${m[1].trim()}`;
}

/**
 * Inverse le point de vue dans un texte FR rédigé pour l'expéditeur (A = vous).
 * Ne change pas les montants ni qui paie réellement.
 * Phrases protégées / reformulées avant le swap générique pour éviter le français cassé.
 */
export function swapPersonWords(text: string): string {
  if (!text) return text;

  let out = text;

  const steps: [RegExp, string][] = [
    // Composés à ne pas casser
    [/\brendez-vous\b/gi, "¤RDV¤"],
    [/\bRendez-vous\b/g, "¤RDV_CAP¤"],
    [/\bVous n'étiez pas\b/g, "¤COUPLE_ETIEZ¤"],
    [/\bvous n'étiez pas\b/g, "¤couple_etiez¤"],
    [/\bentre vous\b/gi, "¤ENTRE_VOUS¤"],
    [/\bd'accord\b/gi, "¤DACCORD¤"],
    [/\bde vous laisser\b/gi, "¤LUI_LAISSER¤"],
    [/\bà votre seul nom\b/gi, "¤SON_NOM¤"],
    [/\bdans votre zone\b/gi, "¤LA_ZONE¤"],
    [/\bdans son zone\b/gi, "¤LA_ZONE¤"],
    [/\bson zone\b/gi, "¤LA_ZONE_BARE¤"],

    // Phrases métier (avant le swap mot-à-mot)
    [/\bVous payez à l'autre\b/g, "¤OTHER_PAYS_YOU¤"],
    [/\bvous payez à l'autre\b/g, "¤other_pays_you¤"],
    [/\bVous recevez de l'autre\b/g, "¤YOU_GET_FROM_OTHER¤"],
    [/\bvous recevez de l'autre\b/g, "¤you_get_from_other¤"],
    [/\bVous rachetez\b/g, "¤OTHER_BUY¤"],
    [/\bvous rachetez\b/g, "¤other_buy¤"],
    [/\bVous gardez\b/g, "¤OTHER_KEEP¤"],
    [/\bvous gardez\b/g, "¤other_keep¤"],
    [/\bVous payez\b/g, "¤OTHER_PAYS¤"],
    [/\bvous payez\b/g, "¤other_pays¤"],
    [/\bL'autre rachète\b/g, "¤YOU_BUY¤"],
    [/\bl'autre rachète\b/g, "¤you_buy¤"],
    [/\bL'autre garde\b/g, "¤YOU_KEEP¤"],
    [/\bl'autre garde\b/g, "¤you_keep¤"],
    [/\bla part de l'autre\b/gi, "¤YOUR_SHARE¤"],
    [/\bpart de l'autre\b/gi, "¤your_share_bare¤"],
    [/\bMensualité de relogement \(autre\)\b/g, "¤RELOC_YOU¤"],
    [/\bMensualité de relogement \(vous\)\b/g, "¤RELOC_OTHER¤"],
    [/\bCe que l'autre repart avec\b/g, "¤YOU_LEAVE_WITH¤"],
    [/\bMontant total à l'autre\b/g, "¤YOU_GET_TOTAL¤"],
    [/\bPartant\s*:/g, "¤YOU_COLON¤"],
    [/\bpartant\s*:/gi, "¤you_colon¤"],

    // Possessifs / pronoms
    [/\bVous\b/g, "¤YOU¤"],
    [/\bvous\b/g, "¤you¤"],
    [/\bVotre\b/g, "¤YOUR¤"],
    [/\bvotre\b/g, "¤your¤"],
    [/\bVos\b/g, "¤YOURS¤"],
    [/\bvos\b/g, "¤yours¤"],
    [/\bL'autre\b/g, "Vous"],
    [/\bl'autre\b/g, "vous"],

    // Restore
    [/¤YOU¤/g, "L'autre"],
    [/¤you¤/g, "l'autre"],
    [/¤YOUR¤/g, "Son"],
    [/¤your¤/g, "son"],
    [/¤YOURS¤/g, "Ses"],
    [/¤yours¤/g, "ses"],
    [/¤OTHER_BUY¤/g, "L'autre rachète"],
    [/¤other_buy¤/g, "l'autre rachète"],
    [/¤OTHER_KEEP¤/g, "L'autre garde"],
    [/¤other_keep¤/g, "l'autre garde"],
    [/¤OTHER_PAYS¤/g, "L'autre paie"],
    [/¤other_pays¤/g, "l'autre paie"],
    [/¤OTHER_PAYS_YOU¤/g, "L'autre vous paie"],
    [/¤other_pays_you¤/g, "l'autre vous paie"],
    [/¤YOU_GET_FROM_OTHER¤/g, "Vous recevez de l'autre"],
    [/¤you_get_from_other¤/g, "vous recevez de l'autre"],
    [/¤YOU_BUY¤/g, "Vous rachetez"],
    [/¤you_buy¤/g, "vous rachetez"],
    [/¤YOU_KEEP¤/g, "Vous gardez"],
    [/¤you_keep¤/g, "vous gardez"],
    [/¤YOUR_SHARE¤/g, "votre part"],
    [/¤your_share_bare¤/g, "votre part"],
    [/¤RELOC_YOU¤/g, "Mensualité de relogement (vous)"],
    [/¤RELOC_OTHER¤/g, "Mensualité de relogement (l'autre)"],
    [/¤YOU_LEAVE_WITH¤/g, "Ce que vous récupérez"],
    [/¤YOU_GET_TOTAL¤/g, "Vous récupérez au total"],
    [/¤YOU_COLON¤/g, "Vous :"],
    [/¤you_colon¤/g, "vous :"],
    [/¤RDV¤/g, "rendez-vous"],
    [/¤RDV_CAP¤/g, "Rendez-vous"],
    [/¤COUPLE_ETIEZ¤/g, "Vous n'étiez pas"],
    [/¤couple_etiez¤/g, "vous n'étiez pas"],
    [/¤ENTRE_VOUS¤/g, "entre vous"],
    [/¤DACCORD¤/g, "d'accord"],
    [/¤LUI_LAISSER¤/g, "de lui laisser"],
    [/¤SON_NOM¤/g, "à son seul nom"],
    [/¤LA_ZONE¤/g, "dans la zone"],
    [/¤LA_ZONE_BARE¤/g, "la zone"],
  ];

  for (const [re, to] of steps) {
    out = out.replace(re, to);
  }

  // Accords grossiers restants
  out = out
    .replace(/\bSon endettement\b/g, "Son endettement")
    .replace(/\bson endettement\b/g, "son endettement")
    .replace(/\bSes parts\b/g, "Ses parts")
    .replace(/\bpart de vous\b/gi, "votre part")
    .replace(/\bà vous\b/gi, "vous")
    .replace(/\bL'autre payez\b/g, "L'autre paie")
    .replace(/\bl'autre payez\b/g, "l'autre paie")
    .replace(/\bL'autre n'étiez\b/g, "Vous n'étiez")
    .replace(/\bl'autre n'étiez\b/g, "vous n'étiez");

  return out;
}
