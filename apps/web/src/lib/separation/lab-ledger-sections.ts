import type { DoorId } from "@separation/schemas";
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
    subtitle: "Peut-on se reloger dans la zone, en solo ?",
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

/** Libellés adaptés au scénario (partage vente vs soulte rachat). */
export function resolveLedgerSectionMeta(
  sectionId: LedgerSectionId,
  doorId?: DoorId
): LedgerSectionMeta {
  const base = LEDGER_SECTION_META[sectionId];
  if (
    sectionId === "echange" &&
    (doorId === "sell" || doorId === "sell_rent")
  ) {
    return {
      ...base,
      title: "Le partage",
      subtitle: "Comment se répartit le produit de vente",
    };
  }
  if (sectionId === "mensuel" && (doorId === "keep_a" || doorId === "keep_b")) {
    return {
      ...base,
      subtitle:
        doorId === "keep_a"
          ? "Ce que vous remboursez chaque mois en restant"
          : "Ce que l'autre rembourse chaque mois en restant",
    };
  }
  if (sectionId === "relogement") {
    if (doorId === "keep_a") {
      return {
        ...base,
        subtitle: "Peut-on se reloger dans la zone ? (celui qui part)",
      };
    }
    if (doorId === "keep_b") {
      return {
        ...base,
        subtitle: "Pouvez-vous vous reloger dans la zone, en solo ?",
      };
    }
    if (doorId === "rent_out") {
      return {
        ...base,
        subtitle: "Chacun doit se loger ailleurs — le bien est loué",
      };
    }
  }
  if (sectionId === "resultat" && doorId === "rent_out") {
    return {
      ...base,
      subtitle: "Cashflow net après crédit, charges et impôts",
    };
  }
  return base;
}

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
