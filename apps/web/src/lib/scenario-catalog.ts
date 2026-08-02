import type {
  AffordabilityVerdict,
  NewLifeCapResult,
  ScenarioComparison,
  ScenarioType,
  UserIntent,
} from "@separation/schemas";
import type { LucideIcon } from "lucide-react";
import { Compass, Home, Key, LogOut } from "lucide-react";
import { formatEuro } from "@/lib/utils";

/** Scénarios patrimoniaux calculés par le moteur (hors meta compare_all). */
export const LIFE_SCENARIOS = [
  "keep_a",
  "keep_b",
  "rent_out",
  "sell",
  "sell_rent",
] as const satisfies readonly Exclude<ScenarioType, "compare_all">[];

export type LifeScenario = (typeof LIFE_SCENARIOS)[number];

export interface ScenarioMeta {
  id: LifeScenario;
  title: string;
  tagline: string;
  icon: LucideIcon;
  intentDefault?: UserIntent;
}

export const SCENARIO_CATALOG: Record<LifeScenario, ScenarioMeta> = {
  keep_a: {
    id: "keep_a",
    title: "Vous gardez le logement",
    tagline: "Racheter la part de l'autre et rester sur place.",
    icon: Key,
    intentDefault: "keep_home",
  },
  keep_b: {
    id: "keep_b",
    title: "L'autre partie rachète",
    tagline: "Vous cédez votre part et repartez avec la soulte.",
    icon: LogOut,
    intentDefault: "walk_away",
  },
  rent_out: {
    id: "rent_out",
    title: "Garder et louer",
    tagline: "Conserver le bien en location — loyer vs crédit.",
    icon: Home,
  },
  sell: {
    id: "sell",
    title: "Vendre pour se reloger",
    tagline: "Liquider le bien puis racheter dans la zone.",
    icon: Compass,
    intentDefault: "amiable_path",
  },
  sell_rent: {
    id: "sell_rent",
    title: "Vendre puis louer",
    tagline: "Liquider le bien, puis se loger en location.",
    icon: Home,
  },
};

export const FLOW_STEPS = [
  {
    phase: "narrative",
    label: "Situation",
    description: "Décrivez votre situation en quelques phrases.",
  },
  {
    phase: "scenarios",
    label: "Scénarios",
    description: "Lisez vos cinq trajectoires et choisissez la vôtre.",
  },
  {
    phase: "secure",
    label: "Sécuriser",
    description: "PDF, médiation, accompagnement pro.",
  },
] as const;

export function intentFromScenarioPreview(
  choice: "keep_a" | "walk_away" | "compare_all"
): UserIntent {
  if (choice === "keep_a") return "keep_home";
  if (choice === "walk_away") return "walk_away";
  return "amiable_path";
}

export function verdictForScenario(
  scenario: ScenarioType,
  cap: NewLifeCapResult | null
): AffordabilityVerdict | null {
  if (!cap || scenario === "compare_all") return null;
  return cap.doors.find((d) => d.id === scenario)?.verdict ?? null;
}

export function scenarioHeadline(
  comparison: ScenarioComparison,
  cap: NewLifeCapResult | null
): string {
  const door = cap?.doors.find((d) => d.id === comparison.scenario);

  if (door?.headline) return door.headline;

  if (comparison.saleProceedsByPerson) {
    return `Vous ${formatEuro(comparison.saleProceedsByPerson.A.amount)} · Autre ${formatEuro(comparison.saleProceedsByPerson.B.amount)}`;
  }
  if (comparison.soulte) {
    return `Soulte ${formatEuro(comparison.soulte.amount.amount)}`;
  }
  if (comparison.monthlyNetCashflow) {
    const total =
      comparison.monthlyNetCashflow.A.amount + comparison.monthlyNetCashflow.B.amount;
    return `Flux net ~${formatEuro(total)}/mois`;
  }
  return `Vous ${formatEuro(comparison.netWorthByPerson.A.amount)} · Autre ${formatEuro(comparison.netWorthByPerson.B.amount)}`;
}

export const VERDICT_BADGE: Record<
  AffordabilityVerdict,
  { label: string; className: string }
> = {
  green: {
    label: "Tenable",
    className: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  },
  orange: {
    label: "Serré",
    className: "bg-amber-100 text-amber-900 ring-amber-200",
  },
  red: {
    label: "Difficile",
    className: "bg-rose-100 text-rose-900 ring-rose-200",
  },
};
