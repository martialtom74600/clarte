import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Simulateur de soulte gratuit — Calcul soulte immobilière",
  description:
    "Calculez gratuitement la soulte lors d'une séparation : rachat de parts immobilières, quote-part, crédit restant. Simulation indicative en 2 minutes.",
  keywords: ["soulte", "simulateur soulte", "rachat parts immobilières", "séparation"],
};

export default function SimulateurSoultePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold text-slate-900">
        Simulateur de soulte gratuit
      </h1>
      <p className="mt-6 text-lg text-slate-600 leading-relaxed">
        Lors d&apos;une séparation, si l&apos;un des co-propriétaires souhaite conserver le
        logement, il doit verser une <strong>soulte</strong> à l&apos;autre pour
        compenser sa part. Notre simulateur estime cette soulte en tenant compte de la
        valeur du bien, du crédit restant et de vos quote-parts.
      </p>

      <section className="mt-10 space-y-4 text-slate-700">
        <h2 className="text-2xl font-semibold text-slate-900">Comment est calculée la soulte ?</h2>
        <p>
          La formule de base : <em>Soulte = (Valeur vénale − Dette restante) × Quote-part de l&apos;autre</em>.
          Des frais de notaire peuvent s&apos;ajouter lors du rachat de parts.
        </p>
        <h2 className="text-2xl font-semibold text-slate-900 pt-4">Pour qui ?</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Concubins en indivision</li>
          <li>Couples pacsés avec bien immobilier commun</li>
          <li>Époux en séparation ou divorce</li>
        </ul>
      </section>

      <Link
        href="/simulation"
        className="mt-10 inline-flex items-center gap-2 rounded-full bg-brand-600 px-8 py-4 text-white font-semibold hover:bg-brand-700"
      >
        Estimer ma soulte gratuitement
        <ArrowRight className="h-5 w-5" />
      </Link>
    </article>
  );
}
