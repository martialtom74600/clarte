import type { WizardState } from "@/lib/wizard-state";
import { formatEuro } from "@/lib/utils";

export interface DossierLine {
  id: string;
  label: string;
  detail: string;
  complete: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  concubinage: "Concubinage",
  pacs: "PACS",
  marriage: "Mariage",
};

export function computeDossierProgress(state: WizardState): {
  percent: number;
  lines: DossierLine[];
  readyForScenarios: boolean;
} {
  const cadreComplete = Boolean(state.status);
  const bienComplete = state.propertyValue > 0 && state.postalCode.length >= 5;
  const vousComplete = state.incomeAMonthly > 0;
  const autreComplete = state.incomeBMonthly > 0;
  const foyerComplete =
    !state.hasMinorChildren || (state.numberOfChildren >= 1 && Boolean(state.custodyType));

  const lines: DossierLine[] = [
    {
      id: "cadre",
      label: "Cadre juridique",
      detail: state.status ? STATUS_LABELS[state.status] : "À renseigner",
      complete: cadreComplete,
    },
    {
      id: "bien",
      label: "Logement commun",
      detail:
        bienComplete
          ? [
              state.postalCode,
              state.propertySurface > 0 ? `${state.propertySurface} m²` : null,
              formatEuro(state.propertyValue),
            ]
              .filter(Boolean)
              .join(" · ")
          : state.postalCode
            ? state.postalCode
            : "À renseigner",
      complete: bienComplete,
    },
    {
      id: "vous",
      label: "Vous",
      detail:
        vousComplete
          ? `${formatEuro(state.incomeAMonthly)}/mois`
          : "Revenu à renseigner",
      complete: vousComplete,
    },
    {
      id: "autre",
      label: "Autre partie",
      detail:
        autreComplete
          ? `${formatEuro(state.incomeBMonthly)}/mois`
          : "Revenu à renseigner",
      complete: autreComplete,
    },
    {
      id: "foyer",
      label: "Foyer",
      detail: state.hasMinorChildren
        ? `${state.numberOfChildren} enfant${state.numberOfChildren > 1 ? "s" : ""}`
        : "Sans enfant mineur",
      complete: foyerComplete,
    },
  ];

  const required = [cadreComplete, bienComplete, vousComplete, autreComplete, foyerComplete];
  const done = required.filter(Boolean).length;
  const percent = Math.round((done / required.length) * 100);
  const readyForScenarios = done === required.length;

  return { percent, lines, readyForScenarios };
}

type StepResolutionInput = Pick<
  WizardState,
  | "step"
  | "status"
  | "propertyValue"
  | "postalCode"
  | "incomeAMonthly"
  | "incomeBMonthly"
  | "hasMinorChildren"
  | "numberOfChildren"
  | "custodyType"
>;

/** Ramène l'utilisateur à l'acte cohérent avec ses données (localStorage legacy). */
export function resolveWizardStep(state: StepResolutionInput, hasResult: boolean): number {
  const { readyForScenarios } = computeDossierProgress(state as WizardState);

  if (!state.status) return 0;
  if (state.propertyValue <= 0 || state.postalCode.length < 5) return 1;
  if (!readyForScenarios) return Math.min(state.step, 2);

  if (!hasResult) return Math.min(state.step, 2);

  if (state.step >= 4) return 4;
  if (state.step === 3) return 3;
  return 3;
}

export function isWizardActComplete(
  actId: number,
  state: WizardState,
  hasResult: boolean
): boolean {
  const { readyForScenarios } = computeDossierProgress(state);
  switch (actId) {
    case 0:
      return Boolean(state.status);
    case 1:
      return state.propertyValue > 0 && state.postalCode.length >= 5;
    case 2:
      return readyForScenarios;
    case 3:
      return hasResult;
    default:
      return false;
  }
}

/** Migre les anciennes étapes (0–8) vers le parcours 5 actes (0–4). */
export function migrateWizardStep(step: number): number {
  if (step <= 4) return step;
  const legacyMap: Record<number, number> = {
    5: 4,
    6: 4,
    7: 4,
    8: 4,
  };
  if (step in legacyMap) return legacyMap[step];
  // Ancien wow prématuré (step 2) → parties ; ancien step 3 → parties
  if (step === 2) return 2;
  if (step === 3) return 2;
  if (step === 4) return 3;
  return Math.min(step, 4);
}
