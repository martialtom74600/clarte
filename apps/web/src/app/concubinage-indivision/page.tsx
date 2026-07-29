import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Concubinage et indivision immobilière — Partage des biens",
  description:
    "Séparation en concubinage : règles d'indivision, quote-parts immobilières, soulte et répartition des dettes.",
  keywords: ["concubinage", "indivision", "séparation concubinage", "partage immobilier"],
};

export default function ConcubinageIndivisionPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold text-slate-900">
        Concubinage et indivision immobilière
      </h1>
      <p className="mt-6 text-lg text-slate-600 leading-relaxed">
        En concubinage, il n&apos;existe pas de communauté de biens automatique. Chaque
        concubin est propriétaire de ses biens personnels. L&apos;immobilier acquis
        ensemble est généralement détenu en indivision, avec des quote-parts à définir.
      </p>

      <section className="mt-10 space-y-4 text-slate-700">
        <h2 className="text-2xl font-semibold text-slate-900">Scénarios fréquents</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Rachat de parts (soulte) par l&apos;un des concubins</li>
          <li>Vente du bien et partage du produit net</li>
          <li>Location d&apos;une partie du logement</li>
          <li>Contentieux en cas de désaccord sur les quote-parts</li>
        </ul>
      </section>

      <Link
        href="/simulation"
        className="mt-10 inline-flex items-center gap-2 rounded-full bg-brand-600 px-8 py-4 text-white font-semibold hover:bg-brand-700"
      >
        Simuler mon indivision
        <ArrowRight className="h-5 w-5" />
      </Link>
    </article>
  );
}
