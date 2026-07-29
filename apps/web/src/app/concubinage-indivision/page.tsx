import type { Metadata } from "next";
import { SeoPageShell } from "@/components/b2c/seo-page-shell";

export const metadata: Metadata = {
  title: "Concubinage et indivision immobilière — Partage des biens",
  description:
    "Séparation en concubinage : règles d'indivision, quote-parts immobilières, soulte et répartition des dettes.",
  keywords: ["concubinage", "indivision", "séparation concubinage", "partage immobilier"],
};

export default function ConcubinageIndivisionPage() {
  return (
    <SeoPageShell title="Concubinage et indivision immobilière" ctaLabel="Simuler mon indivision">
      <p className="text-lg leading-relaxed">
        En concubinage, il n&apos;existe pas de communauté de biens automatique. Chaque concubin est
        propriétaire de ses biens personnels. L&apos;immobilier acquis ensemble est généralement
        détenu en indivision, avec des quote-parts à définir.
      </p>
      <h2 className="pt-8 text-2xl font-semibold text-slate-900">Scénarios fréquents</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Rachat de parts (soulte) par l&apos;un des concubins</li>
        <li>Vente du bien et partage du produit net</li>
        <li>Location d&apos;une partie du logement</li>
        <li>Contentieux en cas de désaccord sur les quote-parts</li>
      </ul>
    </SeoPageShell>
  );
}
