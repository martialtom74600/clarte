import type { Metadata } from "next";
import { SeoPageShell } from "@/components/b2c/seo-page-shell";

export const metadata: Metadata = {
  title: "Séparation immobilière et soulte — Guide complet",
  description:
    "Guide complet sur la séparation immobilière : soulte, partage, crédit, régimes matrimoniaux.",
};

export default function SeparationImmobilierePage() {
  return (
    <SeoPageShell title="Séparation immobilière : soulte et partage">
      <p className="text-lg leading-relaxed">
        Le logement est souvent l&apos;enjeu principal d&apos;une séparation. Que vous soyez
        concubins, pacsés ou mariés, les règles de partage diffèrent selon votre statut et votre
        régime matrimonial.
      </p>
      <p>
        Notre simulateur vous aide à estimer la soulte, comparer les scénarios (rachat, vente,
        location) et préparer vos échanges en toute clarté.
      </p>
    </SeoPageShell>
  );
}
