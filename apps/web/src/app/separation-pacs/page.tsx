import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Séparation PACS — Partage patrimoine et biens communs",
  description:
    "Comprenez la répartition patrimoniale lors d'une rupture de PACS : séparation de biens, indivision immobilière, comptes joints.",
  keywords: ["séparation PACS", "rupture PACS", "partage biens PACS", "patrimoine PACS"],
};

export default function SeparationPacsPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold text-slate-900">
        Séparation et PACS : partage du patrimoine
      </h1>
      <p className="mt-6 text-lg text-slate-600 leading-relaxed">
        Le PACS implique une séparation de biens de plein droit (art. 515-4 du Code civil).
        Chaque partenaire conserve ses biens propres, sauf convention contraire ou biens
        acquis en indivision ou sur compte joint.
      </p>

      <section className="mt-10 space-y-4 text-slate-700">
        <h2 className="text-2xl font-semibold text-slate-900">Points clés</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Biens propres : acquis avant ou pendant le PACS, sauf preuve contraire</li>
          <li>Indivision immobilière : quote-parts à déterminer (souvent 50/50)</li>
          <li>Compte joint : répartition selon contributions ou 50/50 par défaut</li>
          <li>Convention de PACS : peut modifier les règles par défaut</li>
        </ul>
      </section>

      <Link
        href="/simulation"
        className="mt-10 inline-flex items-center gap-2 rounded-full bg-brand-600 px-8 py-4 text-white font-semibold hover:bg-brand-700"
      >
        Simuler ma situation PACS
        <ArrowRight className="h-5 w-5" />
      </Link>
    </article>
  );
}
