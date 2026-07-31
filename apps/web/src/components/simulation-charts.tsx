"use client";

import { cn, formatEuro } from "@/lib/utils";
import { clarte, clarteGlassCard } from "@/lib/clarte-design";
import type { SimulationResult } from "@separation/schemas";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const COLORS = ["#0c8ce9", "#7cc5fb"];

interface PatrimonyChartProps {
  result: SimulationResult;
  className?: string;
}

export function PatrimonyChart({ result, className }: PatrimonyChartProps) {
  const data = [
    { name: "Vous", value: result.netWorthByPerson.A.amount },
    { name: "Autre partie", value: result.netWorthByPerson.B.amount },
  ];

  return (
    <div className={cn("h-64 w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={4}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatEuro(Number(value ?? 0))} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ScenarioCardsProps {
  result: SimulationResult;
  selectedScenario?: string;
  onSelect?: (scenario: string) => void;
}

export function ScenarioCards({ result, selectedScenario, onSelect }: ScenarioCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {result.scenarios.map((scenario) => {
        const selected = selectedScenario === scenario.scenario;
        return (
          <button
            key={scenario.scenario}
            type="button"
            onClick={() => onSelect?.(scenario.scenario)}
            className={cn(
              clarteGlassCard,
              clarte.cardHover,
              "border-2 p-6 text-left transition-colors",
              selected
                ? "border-brand-500 bg-brand-50/80 shadow-[0_0_0_3px_rgba(0,111,199,0.1)]"
                : "border-slate-200/80"
            )}
          >
          <h3 className="font-semibold text-slate-900">{scenario.label}</h3>
          <p className="mt-2 text-sm text-slate-600">{scenario.description}</p>
          <div className="mt-4 space-y-1 text-sm">
            <p>A : <strong>{formatEuro(scenario.netWorthByPerson.A.amount)}</strong></p>
            <p>Autre : <strong>{formatEuro(scenario.netWorthByPerson.B.amount)}</strong></p>
            {scenario.soulte && (
              <p className="text-brand-700 font-medium mt-2">
                Soulte : {formatEuro(scenario.soulte.amount.amount)}
              </p>
            )}
            {scenario.monthlyPaymentEstimate && (
              <p className="text-slate-500">
                Mensualité estimée : {formatEuro(scenario.monthlyPaymentEstimate.amount)}/mois
              </p>
            )}
          </div>
          </button>
        );
      })}
    </div>
  );
}

interface DoubleMirrorProps {
  result: SimulationResult;
}

export function DoubleMirror({ result }: DoubleMirrorProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(["A", "B"] as const).map((person) => (
        <div
          key={person}
          className={cn(clarteGlassCard, "bg-gradient-to-br from-white to-brand-50 p-6")}
        >
          <p className="text-sm font-medium text-slate-500">
            {person === "A" ? "Vous" : "Autre partie"}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {formatEuro(result.netWorthByPerson[person].amount)}
          </p>
          <p className="mt-1 text-sm text-slate-600">Patrimoine net estimé</p>
        </div>
      ))}
    </div>
  );
}

interface WowMomentProps {
  result: SimulationResult;
}

export function WowMoment({ result }: WowMomentProps) {
  const soulte = result.soulte;

  return (
    <div className="rounded-xl border border-brand-200/60 bg-brand-50/40 p-6 md:p-8">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
        Projection indicative
      </p>
      {soulte ? (
        <>
          <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            {formatEuro(soulte.amount.amount)}
          </p>
          <p className="mt-2 text-base text-slate-600">
            Soulte estimée pour racheter la part de l&apos;autre ({soulte.assetLabel})
          </p>
          {soulte.totalCashNeeded && (
            <p className="mt-4 text-sm text-slate-500">
              Cash total estimé (soulte + droit de partage + émoluments) :{" "}
              <span className="font-medium text-slate-800">
                {formatEuro(soulte.totalCashNeeded.amount)}
              </span>
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
            {formatEuro(result.netWorthByPerson.A.amount + result.netWorthByPerson.B.amount)}
          </p>
          <p className="mt-2 text-base text-slate-600">Patrimoine net total estimé</p>
        </>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <span className="rounded-full border border-brand-200/60 bg-white/70 px-3 py-1 text-xs font-medium text-brand-800">
          Complexité : {result.complexityScore}/100
        </span>
        <span className="rounded-full border border-slate-200/80 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600">
          Simulation indicative
        </span>
      </div>
    </div>
  );
}
