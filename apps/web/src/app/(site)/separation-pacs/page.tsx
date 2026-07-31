import type { Metadata } from "next";
import { SeoPageShell } from "@/components/b2c/seo-page-shell";

export const metadata: Metadata = {
  title: "Séparation PACS — Partage patrimoine et biens communs",
  description:
    "Comprenez la répartition patrimoniale lors d'une rupture de PACS : séparation de biens, indivision immobilière, comptes joints.",
  keywords: ["séparation PACS", "rupture PACS", "partage biens PACS", "patrimoine PACS"],
};

export default function SeparationPacsPage() {
  return (
    <SeoPageShell title="Séparation et PACS : partage du patrimoine" ctaLabel="Simuler ma situation PACS">
      <p className="text-lg leading-relaxed">
        Le PACS implique une séparation de biens de plein droit (art. 515-4 du Code civil). Chaque
        partenaire conserve ses biens propres, sauf convention contraire ou biens acquis en indivision
        ou sur compte joint.
      </p>
      <h2 className="pt-8 text-2xl font-semibold text-slate-900">Points clés</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Biens propres : acquis avant ou pendant le PACS, sauf preuve contraire</li>
        <li>Indivision immobilière : quote-parts à déterminer (souvent 50/50)</li>
        <li>Compte joint : répartition selon contributions ou 50/50 par défaut</li>
        <li>Convention de PACS : peut modifier les règles par défaut</li>
      </ul>
    </SeoPageShell>
  );
}
