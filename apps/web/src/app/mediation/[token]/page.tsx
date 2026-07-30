"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { InputField } from "@/components/ui/input-field";
import { FadeIn, ShimmerSkeleton } from "@/components/ui";
import { clarte, clarteGlassCard } from "@/lib/clarte-design";
import type { MediationComparison } from "@separation/engine";
import { cn, formatEuro } from "@/lib/utils";

export default function MediationPage() {
  const params = useParams();
  const token = params.token as string;
  const [status, setStatus] = useState<string>("loading");
  const [propertyValue, setPropertyValue] = useState(0);
  const [mortgageRemaining, setMortgageRemaining] = useState(0);
  const [incomeA, setIncomeA] = useState(0);
  const [incomeB, setIncomeB] = useState(0);
  const [comparison, setComparison] = useState<MediationComparison | null>(null);

  useEffect(() => {
    fetch(`/api/mediation/${token}`)
      .then((r) => r.json())
      .then((d) => setStatus(d.status ?? "ready"))
      .catch(() => setStatus("error"));
  }, [token]);

  const handleSubmit = async () => {
    const res = await fetch(`/api/mediation/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partyBData: {
          propertyValue,
          mortgageRemaining,
          incomeAMonthly: incomeA,
          incomeBMonthly: incomeB,
        },
      }),
    });
    const data = await res.json();
    if (data.comparison) {
      setComparison(data.comparison);
      setStatus("compared");
    }
  };

  if (status === "loading") {
    return (
      <div className={`${clarte.containerNarrow} py-16`}>
        <ShimmerSkeleton className="h-8 w-48" />
        <ShimmerSkeleton className="mt-4 h-4 w-full max-w-md" />
        <ShimmerSkeleton className={`mt-8 h-64 ${clarte.radiusMd}`} />
      </div>
    );
  }

  if (comparison || status === "compared") {
    const comp = comparison!;
    return (
      <FadeIn className={`${clarte.containerNarrow} py-16`}>
        <h1 className="text-2xl font-bold text-slate-900">Points de désaccord</h1>
        <p className="mt-2 text-slate-600">
          Accord sur {comp?.agreementRate ?? 0}% des champs — seuls les écarts sont affichés.
        </p>
        <div className="mt-8 space-y-4">
          {(comp?.diffs ?? []).map((d) => (
            <div key={d.field} className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
              <p className="font-semibold text-amber-900">{d.label}</p>
              <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Version A</p>
                  <p className="font-medium">
                    {typeof d.valueA === "number" && d.unit === "€"
                      ? formatEuro(d.valueA)
                      : d.valueA}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Version B</p>
                  <p className="font-medium">
                    {typeof d.valueB === "number" && d.unit === "€"
                      ? formatEuro(d.valueB)
                      : d.valueB}
                  </p>
                </div>
              </div>
              {d.delta !== undefined && d.unit === "€" && (
                <p className="mt-2 text-xs text-amber-800">
                  Écart : {formatEuro(Math.abs(d.delta))}
                </p>
              )}
            </div>
          ))}
        </div>
        {comp?.hasSignificantDisagreement && (
          <p className="mt-6 text-sm text-slate-600">
            Plusieurs écarts significatifs : un notaire ou médiateur peut vous aider à converger.
          </p>
        )}
      </FadeIn>
    );
  }

  return (
    <FadeIn className={`${clarte.containerNarrow} py-16`}>
      <h1 className="text-2xl font-bold text-slate-900">Votre vision des finances</h1>
      <p className="mt-2 text-slate-600">
        Remplissez votre version. L&apos;autre partie ne verra que les différences — pas vos chiffres complets.
      </p>
      <div className={cn(clarteGlassCard, "mt-8 space-y-5 p-6")}>
        <InputField label="Valeur du bien (€)" type="number" value={propertyValue || ""} onChange={(v) => setPropertyValue(Number(v) || 0)} />
        <InputField label="Crédit restant (€)" type="number" value={mortgageRemaining || ""} onChange={(v) => setMortgageRemaining(Number(v) || 0)} />
        <InputField label="Votre revenu mensuel (€)" type="number" value={incomeA || ""} onChange={(v) => setIncomeA(Number(v) || 0)} />
        <InputField label="Revenu de l'autre (€)" type="number" value={incomeB || ""} onChange={(v) => setIncomeB(Number(v) || 0)} optional />
        <button type="button" onClick={handleSubmit} className={cn("px-8 py-3", clarte.btnPrimary)}>
          Comparer les versions
        </button>
      </div>
    </FadeIn>
  );
}
