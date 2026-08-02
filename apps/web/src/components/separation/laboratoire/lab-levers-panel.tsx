"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DoorId, RelocateMarketTier } from "@separation/schemas";
import { defaultRelocateSurfaceSqm } from "@separation/engine";
import { useSeparationStore } from "@/store/separation-store";
import { defaultMortgagePayment } from "@/lib/separation/lab-ledger-model";
import { LabField, LabLever } from "./lab-lever";
import { useDebouncedCallback } from "@/lib/separation/use-debounced-callback";
import type { LeverOverrides } from "@/lib/separation/separation-types";
import { cn, formatEuro } from "@/lib/utils";

/** Portes où le relogement solo a un effet sur le bilan. */
const RELOCATE_DOORS: DoorId[] = ["keep_a", "keep_b", "sell", "sell_rent"];

type ChildrenImpactConfig = NonNullable<LeverOverrides["children_impact"]>;
type LabLeverId =
  | "initial_contributions"
  | "historical_mortgage_rate"
  | "children_impact"
  | "occupation_indemnity"
  | "relocate_housing";

const MARKET_TIER_OPTIONS: { value: RelocateMarketTier; label: string }[] = [
  { value: "entry", label: "Entrée de zone" },
  { value: "median", label: "Médian" },
  { value: "high", label: "Haut de zone" },
];

function parseAmount(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function formatAmount(n: number): string {
  if (n <= 0) return "";
  return n.toLocaleString("fr-FR");
}

const LEVER_COPY: Record<
  LabLeverId,
  Record<DoorId, { title: string; description: string; impact: string }>
> = {
  initial_contributions: {
    keep_a: {
      title: "Apports initiaux",
      description: "Si l'un de vous a mis plus d'argent au départ, ça change le montant du rachat.",
      impact: "Recalcule ce que vous devez verser.",
    },
    keep_b: {
      title: "Apports initiaux",
      description: "Si l'un de vous a mis plus d'argent au départ, ça change le montant du rachat.",
      impact: "Recalcule ce que vous recevrez.",
    },
    sell: {
      title: "Apports initiaux",
      description: "En cas de vente, on repartage surtout selon vos parts. Les apports aident surtout le rachat.",
      impact: "Peu d'effet sur ce scénario de vente.",
    },
    sell_rent: {
      title: "Apports initiaux",
      description: "En cas de vente, on repartage surtout selon vos parts. Les apports n'ont pas d'effet sur le loyer.",
      impact: "Peu d'effet sur ce scénario de vente.",
    },
    rent_out: {
      title: "Apports initiaux",
      description: "Les apports changent surtout le prix d'un rachat, pas le loyer mensuel.",
      impact: "Peu d'effet sur le scénario locatif.",
    },
  },
  historical_mortgage_rate: {
    keep_a: {
      title: "Ajuster la mensualité du crédit",
      description:
        "La mensualité vient de l'empreinte. Affinez-la ici si besoin. Hypothèse : la banque accepte la désolidarisation — vous ne refinancez alors que le rachat de part.",
      impact: "Affine la mensualité déjà saisie — sous réserve d'accord banque.",
    },
    keep_b: {
      title: "Ajuster la mensualité du crédit",
      description:
        "Hypothèse : la banque laisse l'autre reprendre le prêt aux conditions actuelles et ne refinance que votre rachat de part. La désolidarisation reste à l'appréciation de la banque.",
      impact: "Affine la mensualité et le verdict — sous réserve d'accord banque.",
    },
    sell: {
      title: "Ajuster la mensualité du crédit",
      description: "Sans bien à garder, ce levier ne s'applique pas — le crédit est remboursé à la vente.",
      impact: "Sans effet sur ce scénario.",
    },
    sell_rent: {
      title: "Ajuster la mensualité du crédit",
      description: "Sans bien à garder, ce levier ne s'applique pas — le crédit est remboursé à la vente.",
      impact: "Sans effet sur ce scénario.",
    },
    rent_out: {
      title: "Ajuster la mensualité du crédit",
      description:
        "Affine votre mensualité (souvent plus basse que le taux marché) pour voir si le loyer couvre le crédit.",
      impact: "Recalcule l'excédent ou le déficit locatif.",
    },
  },
  children_impact: {
    keep_a: {
      title: "Budget pour les enfants",
      description: "Estime la contribution mensuelle selon le barème indicatif du ministère de la Justice.",
      impact: "Ajoute une charge mensuelle et peut durcir le verdict HCSF.",
    },
    keep_b: {
      title: "Budget pour les enfants",
      description: "Estime la contribution mensuelle selon le barème indicatif du ministère de la Justice.",
      impact: "Pris en compte dans le budget de celui qui rachète.",
    },
    sell: {
      title: "Budget pour les enfants",
      description: "Estime la contribution mensuelle selon le barème indicatif du ministère de la Justice.",
      impact: "Réduit la capacité de rachat après vente de celui qui paie.",
    },
    sell_rent: {
      title: "Budget pour les enfants",
      description: "Estime la contribution mensuelle selon le barème indicatif du ministère de la Justice.",
      impact: "Réduit la capacité locative de celui qui paie.",
    },
    rent_out: {
      title: "Budget pour les enfants",
      description: "Estime la contribution mensuelle selon le barème indicatif du ministère de la Justice.",
      impact: "Affiché dans le bilan (charge à côté du loyer).",
    },
  },
  occupation_indemnity: {
    keep_a: {
      title: "Temps passé seul dans le logement avant signature",
      description:
        "Si vous occupez le bien seul avant l'acte, une indemnité d'occupation peut être due à l'autre (loyer estimé ÷ 2 × nombre de mois).",
      impact: "Augmente le capital récupéré par le partant et le montant à financer.",
    },
    keep_b: {
      title: "Temps passé seul dans le logement avant signature",
      description:
        "Si l'autre occupe le bien seul avant l'acte, une indemnité d'occupation peut s'imputer sur le rachat (loyer estimé ÷ 2 × mois).",
      impact: "Augmente ce que vous récupérez et ce que l'autre doit financer.",
    },
    sell: {
      title: "Temps passé seul dans le logement avant signature",
      description: "Sur une vente, l'indemnité d'occupation se discute à part — non modélisée ici.",
      impact: "Sans effet sur ce scénario.",
    },
    sell_rent: {
      title: "Temps passé seul dans le logement avant signature",
      description: "Sur une vente, l'indemnité d'occupation se discute à part — non modélisée ici.",
      impact: "Sans effet sur ce scénario.",
    },
    rent_out: {
      title: "Temps passé seul dans le logement avant signature",
      description: "Ce levier concerne le rachat, pas la location.",
      impact: "Sans effet sur ce scénario.",
    },
  },
  relocate_housing: {
    keep_a: {
      title: "Relogement de l'autre (qui part)",
      description:
        "Vous restez dans le bien. Ce levier estime où l'autre peut se loger avec la soulte — pas le même appartement.",
      impact: "Recalcule uniquement la capacité de relogement du partant.",
    },
    keep_b: {
      title: "Votre relogement (si vous partez)",
      description:
        "L'autre garde le bien. Ce levier estime où vous pouvez vous loger avec ce que vous récupérez — pas le même appartement.",
      impact: "Recalcule uniquement votre capacité de relogement.",
    },
    sell: {
      title: "Relogement après vente",
      description:
        "Plus personne ne garde le bien : chaque côté rachète ailleurs. Surface cible et gamme (entrée / médian / haut de zone).",
      impact: "Recalcule le prix cible et le verdict pour chacun.",
    },
    sell_rent: {
      title: "Location après vente",
      description:
        "Plus personne ne garde le bien : chaque côté loue ailleurs. Surface cible et gamme de loyer de la zone.",
      impact: "Recalcule le loyer cible et le verdict pour chacun.",
    },
    rent_out: {
      title: "Relogement",
      description: "Sans effet ici — le bien est conservé en location.",
      impact: "Sans effet sur ce scénario.",
    },
  },
};

interface LabLeversPanelProps {
  doorId: DoorId;
}

export function LabLeversPanel({ doorId }: LabLeversPanelProps) {
  const footprint = useSeparationStore((s) => s.footprint);
  const assumptions = useSeparationStore((s) => s.assumptions);
  const lab = useSeparationStore((s) => s.lab);
  const disableLever = useSeparationStore((s) => s.disableLever);
  const setLeverOverride = useSeparationStore((s) => s.setLeverOverride);

  const marketMonthly = defaultMortgagePayment(footprint, assumptions);

  const contributionsEnabled = lab.enabledLevers.includes("initial_contributions");
  const historicalEnabled = lab.enabledLevers.includes("historical_mortgage_rate");
  const childrenEnabled = lab.enabledLevers.includes("children_impact");
  const occupationEnabled = lab.enabledLevers.includes("occupation_indemnity");
  const relocateEnabled = lab.enabledLevers.includes("relocate_housing");

  const childrenForDefault =
    childrenEnabled &&
    lab.overrides.children_impact?.hasMinorChildren &&
    (lab.overrides.children_impact.numberOfChildren ?? 0) > 0
      ? lab.overrides.children_impact.numberOfChildren
      : 0;
  const defaultRelocateSurface = defaultRelocateSurfaceSqm(
    footprint.propertySurface > 0 ? footprint.propertySurface : 65,
    childrenForDefault
  );

  const [contribA, setContribA] = useState(
    formatAmount(
      lab.overrides.initial_contributions?.contributionA ?? footprint.contributionA
    )
  );
  const [contribB, setContribB] = useState(
    formatAmount(
      lab.overrides.initial_contributions?.contributionB ?? footprint.contributionB
    )
  );
  const [historicalPay, setHistoricalPay] = useState(
    formatAmount(
      lab.overrides.historical_mortgage_rate?.monthlyMortgagePayment ??
        (footprint.monthlyMortgagePayment > 0
          ? footprint.monthlyMortgagePayment
          : marketMonthly)
    )
  );
  const [occupationMonths, setOccupationMonths] = useState(
    String(lab.overrides.occupation_indemnity?.occupationMonths ?? 8)
  );
  const [relocateSurface, setRelocateSurface] = useState(
    String(lab.overrides.relocate_housing?.surfaceSqm ?? defaultRelocateSurface)
  );
  const [relocateTier, setRelocateTier] = useState<RelocateMarketTier>(
    lab.overrides.relocate_housing?.marketTier ?? "entry"
  );

  const childrenCfg = lab.overrides.children_impact ?? {
    hasMinorChildren: false,
    numberOfChildren: 0,
    custodyType: "classic" as const,
  };

  const commitContributions = useDebouncedCallback(
    (a: number, b: number) => {
      setLeverOverride("initial_contributions", { contributionA: a, contributionB: b });
    },
    200
  );

  const commitHistorical = useDebouncedCallback((monthly: number) => {
    setLeverOverride("historical_mortgage_rate", {
      monthlyMortgagePayment: monthly,
      ...(footprint.initialMortgageRate > 0
        ? { mortgageRate: footprint.initialMortgageRate }
        : {}),
    });
  }, 200);

  const commitChildren = useDebouncedCallback((cfg: ChildrenImpactConfig) => {
    setLeverOverride("children_impact", cfg);
  }, 200);

  const commitOccupation = useDebouncedCallback((months: number) => {
    setLeverOverride("occupation_indemnity", {
      occupationMonths: Math.min(120, Math.max(1, months)),
    });
  }, 200);

  const commitRelocate = useDebouncedCallback(
    (surfaceSqm: number, marketTier: RelocateMarketTier) => {
      setLeverOverride("relocate_housing", {
        surfaceSqm: Math.min(150, Math.max(25, surfaceSqm)),
        marketTier,
      });
    },
    200
  );

  const pushContributions = (a: string, b: string) => {
    if (!contributionsEnabled) return;
    commitContributions(parseAmount(a), parseAmount(b));
  };

  const pushHistorical = (raw: string) => {
    if (!historicalEnabled) return;
    commitHistorical(parseAmount(raw));
  };

  const pushOccupation = (raw: string) => {
    if (!occupationEnabled) return;
    commitOccupation(parseAmount(raw) || 1);
  };

  const pushRelocateSurface = (raw: string, tier: RelocateMarketTier) => {
    if (!relocateEnabled) return;
    commitRelocate(parseAmount(raw) || defaultRelocateSurface, tier);
  };

  const relocateDismissedRef = useRef(false);

  const toggleLever = useCallback(
    (leverId: LabLeverId, on: boolean) => {
      if (!on) {
        if (leverId === "relocate_housing") relocateDismissedRef.current = true;
        disableLever(leverId);
        return;
      }
      if (leverId === "relocate_housing") relocateDismissedRef.current = false;
      // setLeverOverride active aussi le levier — un seul recompute.
      if (leverId === "initial_contributions") {
        const a = parseAmount(contribA) || footprint.contributionA;
        const b = parseAmount(contribB) || footprint.contributionB;
        setContribA(formatAmount(a));
        setContribB(formatAmount(b));
        setLeverOverride("initial_contributions", {
          contributionA: a,
          contributionB: b,
        });
      }
      if (leverId === "historical_mortgage_rate") {
        const monthly = parseAmount(historicalPay) || marketMonthly;
        setHistoricalPay(formatAmount(monthly));
        setLeverOverride("historical_mortgage_rate", {
          monthlyMortgagePayment: monthly,
          ...(footprint.initialMortgageRate > 0
            ? { mortgageRate: footprint.initialMortgageRate }
            : {}),
        });
      }
      if (leverId === "children_impact") {
        setLeverOverride("children_impact", {
          hasMinorChildren: false,
          numberOfChildren: 0,
          custodyType: "classic",
        });
      }
      if (leverId === "occupation_indemnity") {
        const months = parseAmount(occupationMonths) || 8;
        setOccupationMonths(String(months));
        setLeverOverride("occupation_indemnity", { occupationMonths: months });
      }
      if (leverId === "relocate_housing") {
        const surface = parseAmount(relocateSurface) || defaultRelocateSurface;
        setRelocateSurface(String(surface));
        setRelocateTier(relocateTier);
        setLeverOverride("relocate_housing", {
          surfaceSqm: surface,
          marketTier: relocateTier,
        });
      }
    },
    [
      disableLever,
      setLeverOverride,
      contribA,
      contribB,
      historicalPay,
      marketMonthly,
      occupationMonths,
      relocateSurface,
      relocateTier,
      defaultRelocateSurface,
      footprint.initialMortgageRate,
      footprint.contributionA,
      footprint.contributionB,
    ]
  );

  const contribCopy = LEVER_COPY.initial_contributions[doorId];
  const histCopy = LEVER_COPY.historical_mortgage_rate[doorId];
  const childrenCopy = LEVER_COPY.children_impact[doorId];
  const occupationCopy = LEVER_COPY.occupation_indemnity[doorId];
  const relocateCopy = LEVER_COPY.relocate_housing[doorId];
  const noCredit =
    footprint.financementDeclared && footprint.mortgageRemaining === 0;
  const historicalRelevant = doorId !== "sell" && doorId !== "sell_rent" && !noCredit;
  const contributionsRelevant = doorId === "keep_a" || doorId === "keep_b";
  const occupationRelevant = doorId === "keep_a" || doorId === "keep_b";
  const relocateRelevant = RELOCATE_DOORS.includes(doorId);
  const hasEmpreinteApports =
    footprint.contributionA > 0 || footprint.contributionB > 0;

  // Sessions Empreinte déjà validées avant le seed relocate : pré-active à l'ouverture.
  useEffect(() => {
    if (!relocateRelevant || footprint.propertySurface <= 0) return;
    if (lab.enabledLevers.includes("relocate_housing")) return;
    if (relocateDismissedRef.current) return;
    setLeverOverride("relocate_housing", {
      surfaceSqm: defaultRelocateSurface,
      marketTier: "entry",
    });
  }, [
    doorId,
    relocateRelevant,
    footprint.propertySurface,
    lab.enabledLevers,
    defaultRelocateSurface,
    setLeverOverride,
  ]);

  return (
    <div className="space-y-4">
      <div className="mb-4 lg:mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Vos ajustements</p>
        <h2 className="mt-1 text-lg font-light text-slate-900 lg:mt-2 lg:text-xl">Affinez votre scénario</h2>
        <p className="mt-1.5 text-sm text-slate-500 lg:mt-2">
          Chaque interrupteur recalcule le bilan. Le résumé reste visible à gauche (ou dans l&apos;onglet Calcul).
        </p>
      </div>

      {contributionsRelevant && (
        <LabLever
          title={contribCopy.title}
          description={`${contribCopy.description} ${contribCopy.impact}${
            hasEmpreinteApports
              ? " Prérempli depuis votre Empreinte — vous pouvez ajuster."
              : ""
          }`}
          enabled={contributionsEnabled}
          onToggle={(on) => toggleLever("initial_contributions", on)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <LabField
              label="Vos apports"
              value={contribA}
              onChange={(v) => {
                const next = formatAmount(parseAmount(v));
                setContribA(next);
                pushContributions(next, contribB);
              }}
              suffix="€"
            />
            <LabField
              label="Apports de l'autre"
              value={contribB}
              onChange={(v) => {
                const next = formatAmount(parseAmount(v));
                setContribB(next);
                pushContributions(contribA, next);
              }}
              suffix="€"
            />
          </div>
        </LabLever>
      )}

      {historicalRelevant && (
        <LabLever
          title={histCopy.title}
          description={`${histCopy.description}`}
          enabled={historicalEnabled}
          onToggle={(on) => toggleLever("historical_mortgage_rate", on)}
        >
          <div className="mb-4 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600">
            <p>
              <span className="font-medium text-slate-800">Sans ce levier :</span> on suppose un
              refinancement complet au taux marché (
              <span className="tabular-nums">{formatEuro(marketMonthly)}/mois</span> sur le seul
              CRD, davantage si rachat).
            </p>
            <p className="mt-2">
              <span className="font-medium text-slate-800">Avec ce levier :</span>{" "}
              {doorId === "rent_out"
                ? "on part de votre vraie mensualité pour le cashflow locatif."
                : "vous gardez cette mensualité sur le crédit restant, et n'empruntez que pour le rachat — uniquement si la banque accepte la désolidarisation."}
            </p>
            {(doorId === "keep_a" || doorId === "keep_b") && (
              <p className="mt-2 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-900">
                La désolidarisation de l&apos;emprunt initial est soumise à l&apos;accord
                discrétionnaire de la banque (ratio d&apos;endettement et étude de solvabilité du
                repreneur). Ce n&apos;est pas une option garantie.
              </p>
            )}
            <p className="mt-2 text-xs text-slate-500">{histCopy.impact}</p>
          </div>
          <LabField
            label="Votre mensualité actuelle"
            value={historicalPay}
            onChange={(v) => {
              const next = formatAmount(parseAmount(v));
              setHistoricalPay(next);
              pushHistorical(next);
            }}
            suffix="€/mois"
            hint={`Référence marché estimée : ${formatEuro(marketMonthly)}/mois`}
          />
        </LabLever>
      )}

      <LabLever
        title={childrenCopy.title}
        description={`${childrenCopy.description} ${childrenCopy.impact}`}
        enabled={childrenEnabled}
        onToggle={(on) => toggleLever("children_impact", on)}
      >
        <ChildrenLeverFields
          cfg={childrenCfg}
          onChange={(cfg) => commitChildren(cfg)}
        />
      </LabLever>

      {occupationRelevant && (
        <LabLever
          title={occupationCopy.title}
          description={`${occupationCopy.description} ${occupationCopy.impact}`}
          enabled={occupationEnabled}
          onToggle={(on) => toggleLever("occupation_indemnity", on)}
        >
          <LabField
            label="Nombre de mois seul(e) dans le logement"
            value={occupationMonths}
            onChange={(v) => {
              const digits = v.replace(/\D/g, "");
              setOccupationMonths(digits);
              pushOccupation(digits);
            }}
            suffix="mois"
            hint="Exemple : 8 mois → indemnité = (loyer estimé ÷ 2) × 8"
          />
        </LabLever>
      )}

      {relocateRelevant && (
        <LabLever
          title={relocateCopy.title}
          description={`${relocateCopy.description} ${relocateCopy.impact}`}
          enabled={relocateEnabled}
          onToggle={(on) => toggleLever("relocate_housing", on)}
        >
          <div className="space-y-4">
            <LabField
              label="Surface cible"
              value={relocateSurface}
              onChange={(v) => {
                const digits = v.replace(/\D/g, "");
                setRelocateSurface(digits);
                pushRelocateSurface(digits, relocateTier);
              }}
              suffix="m²"
              hint={`Défaut solo ~${defaultRelocateSurface} m² (≈ 55 % de votre bien${
                childrenForDefault > 0 ? ` + enfants` : ""
              }).`}
            />
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Gamme de marché</p>
              <div className="flex flex-wrap gap-2">
                {MARKET_TIER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setRelocateTier(opt.value);
                      pushRelocateSurface(relocateSurface, opt.value);
                    }}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm transition-colors",
                      relocateTier === opt.value
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Entrée = prix/loyer bas de zone · Médian = milieu · Haut = haut de fourchette.
              </p>
            </div>
          </div>
        </LabLever>
      )}
    </div>
  );
}

function ChildrenLeverFields({
  cfg,
  onChange,
}: {
  cfg: ChildrenImpactConfig;
  onChange: (cfg: ChildrenImpactConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-700">Enfants mineurs à charge ?</p>
      <div className="flex gap-2">
        {[
          { value: false, label: "Non" },
          { value: true, label: "Oui" },
        ].map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() =>
              onChange({
                ...cfg,
                hasMinorChildren: opt.value,
                numberOfChildren: opt.value ? Math.max(1, cfg.numberOfChildren) : 0,
              })
            }
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition-colors",
              cfg.hasMinorChildren === opt.value
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-200 text-slate-600 hover:border-slate-300"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {cfg.hasMinorChildren && (
        <>
          <LabField
            label="Nombre d'enfants"
            value={String(cfg.numberOfChildren || "")}
            onChange={(v) =>
              onChange({
                ...cfg,
                numberOfChildren: Math.min(6, Math.max(1, parseAmount(v) || 1)),
              })
            }
          />
          <p className="text-sm font-medium text-slate-700">Type de garde</p>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "classic" as const, label: "Classique" },
              { value: "alternate" as const, label: "Alternée" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...cfg, custodyType: opt.value })}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm transition-colors",
                  cfg.custodyType === opt.value
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
