import { getSimulationByToken } from "@/lib/supabase";
import { formatEuro } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const simulation = await getSimulationByToken(token);

  if (!simulation) {
    notFound();
  }

  const result = simulation.result_data as {
    netWorthByPerson?: { A?: { amount: number }; B?: { amount: number } };
    soulte?: { amount?: { amount: number } };
    complexityScore?: number;
  };

  const soulteVisible = result.soulte?.amount?.amount;
  const netA = result.netWorthByPerson?.A?.amount;
  const netB = result.netWorthByPerson?.B?.amount;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-900">
        Simulation partagée
      </h1>
      <p className="mt-2 text-slate-600">
        Aperçu partiel — inscrivez-vous pour voir le détail complet.
      </p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8">
        {soulteVisible !== undefined && (
          <div className="mb-6">
            <p className="text-sm text-slate-500">Soulte estimée</p>
            <p className="text-3xl font-bold text-brand-600">
              {formatEuro(soulteVisible)}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="blur-sm select-none">
            <p className="text-sm text-slate-500">Personne A</p>
            <p className="text-xl font-semibold">
              {netA !== undefined ? formatEuro(netA) : "••••••"}
            </p>
          </div>
          <div className="blur-sm select-none">
            <p className="text-sm text-slate-500">Personne B</p>
            <p className="text-xl font-semibold">
              {netB !== undefined ? formatEuro(netB) : "••••••"}
            </p>
          </div>
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Complexité : {result.complexityScore ?? "—"}/100
        </p>
      </div>

      <Link
        href="/simulation"
        className="mt-8 inline-block rounded-full bg-brand-600 px-8 py-3 text-white font-medium hover:bg-brand-700"
      >
        Voir le détail complet
      </Link>
    </div>
  );
}
