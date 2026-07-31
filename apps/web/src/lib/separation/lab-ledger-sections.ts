import type { LedgerLine } from "./lab-ledger-model";

export type LedgerSectionId =
  | "bien"
  | "echange"
  | "revenus"
  | "charges"
  | "resultat"
  | "mensuel"
  | "relogement"
  | "enfants";

export interface LedgerSectionMeta {
  title: string;
  subtitle: string;
  border: string;
  bg: string;
  titleColor: string;
}

export const LEDGER_SECTION_META: Record<LedgerSectionId, LedgerSectionMeta> = {
  bien: {
    title: "Le bien",
    subtitle: "Combien vaut le logement, une fois le crédit déduit ?",
    border: "border-l-brand-500",
    bg: "bg-brand-50/60",
    titleColor: "text-brand-900",
  },
  echange: {
    title: "L'échange d'argent",
    subtitle: "Qui paie quoi pour sortir du bien ensemble",
    border: "border-l-violet-500",
    bg: "bg-violet-50/50",
    titleColor: "text-violet-900",
  },
  revenus: {
    title: "Revenus locatifs",
    subtitle: "Ce que le loyer peut rapporter chaque mois",
    border: "border-l-emerald-500",
    bg: "bg-emerald-50/50",
    titleColor: "text-emerald-900",
  },
  charges: {
    title: "Charges à payer",
    subtitle: "Ce qui se déduit du loyer, mois après mois",
    border: "border-l-rose-400",
    bg: "bg-rose-50/40",
    titleColor: "text-rose-900",
  },
  resultat: {
    title: "Il vous reste",
    subtitle: "L'argent net après toutes les charges",
    border: "border-l-brand-600",
    bg: "bg-brand-50/80",
    titleColor: "text-brand-900",
  },
  mensuel: {
    title: "Chaque mois",
    subtitle: "Mensualités après la séparation",
    border: "border-l-amber-500",
    bg: "bg-amber-50/50",
    titleColor: "text-amber-950",
  },
  relogement: {
    title: "Relogement",
    subtitle: "Peut-on se reloger dans le même quartier ?",
    border: "border-l-slate-400",
    bg: "bg-slate-50/80",
    titleColor: "text-slate-800",
  },
  enfants: {
    title: "Enfants",
    subtitle: "Budget mensuel lié aux enfants",
    border: "border-l-pink-400",
    bg: "bg-pink-50/45",
    titleColor: "text-pink-950",
  },
};

export interface LedgerLineGroup {
  sectionId: LedgerSectionId;
  lines: LedgerLine[];
}

export function groupLedgerLines(lines: LedgerLine[]): LedgerLineGroup[] {
  const groups: LedgerLineGroup[] = [];

  for (const line of lines) {
    const sectionId = line.sectionId ?? "bien";
    const last = groups[groups.length - 1];
    if (last?.sectionId === sectionId) {
      last.lines.push(line);
    } else {
      groups.push({ sectionId, lines: [line] });
    }
  }

  return groups;
}
