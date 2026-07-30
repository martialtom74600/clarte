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
    { name: "Personne A", value: result.netWorthByPerson.A.amount },
    { name: "Personne B", value: result.netWorthByPerson.B.amount },
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
  onSelect?: (scenario: string) => void;
}

export function ScenarioCards({ result, onSelect }: ScenarioCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {result.scenarios.map((scenario) => (
        <button
          key={scenario.scenario}
          type="button"
          onClick={() => onSelect?.(scenario.scenario)}
          className={cn(clarteGlassCard, clarte.cardHover, "p-6 text-left")}
        >
          <h3 className="font-semibold text-slate-900">{scenario.label}</h3>
          <p className="mt-2 text-sm text-slate-600">{scenario.description}</p>
          <div className="mt-4 space-y-1 text-sm">
            <p>A : <strong>{formatEuro(scenario.netWorthByPerson.A.amount)}</strong></p>
            <p>B : <strong>{formatEuro(scenario.netWorthByPerson.B.amount)}</strong></p>
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
      ))}
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
          <p className="text-sm font-medium text-slate-500">Personne {person}</p>
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
    <div className={cn(clarte.radiusLg, clarte.hero, "p-8 text-white shadow-xl")}>
      <p className="text-brand-100 text-sm font-medium uppercase tracking-wide">
        Votre estimation
      </p>
      {soulte ? (
        <>
          <p className="mt-4 text-4xl md:text-5xl font-bold">
            {formatEuro(soulte.amount.amount)}
          </p>
          <p className="mt-2 text-brand-100 text-lg">
            Soulte estimée pour racheter la part de l&apos;autre ({soulte.assetLabel})
          </p>
          {soulte.totalCashNeeded && (
            <p className="mt-4 text-sm text-brand-200">
              Cash total estimé (soulte + frais notaire) :{" "}
              {formatEuro(soulte.totalCashNeeded.amount)}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mt-4 text-4xl md:text-5xl font-bold">
            {formatEuro(result.netWorthByPerson.A.amount + result.netWorthByPerson.B.amount)}
          </p>
          <p className="mt-2 text-brand-100 text-lg">Patrimoine net total estimé</p>
        </>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <span className="rounded-full bg-white/20 px-4 py-1.5 text-sm">
          Complexité : {result.complexityScore}/100
        </span>
        <span className="rounded-full bg-white/20 px-4 py-1.5 text-sm">
          Simulation indicative
        </span>
      </div>
    </div>
  );
}
