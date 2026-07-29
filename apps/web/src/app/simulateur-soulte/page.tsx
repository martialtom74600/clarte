import type { Metadata } from "next";
import { SeoPageShell } from "@/components/b2c/seo-page-shell";

export const metadata: Metadata = {
  title: "Simulateur de soulte gratuit — Calcul soulte immobilière",
  description:
    "Calculez gratuitement la soulte lors d'une séparation : rachat de parts immobilières, quote-part, crédit restant. Simulation indicative en 2 minutes.",
  keywords: ["soulte", "simulateur soulte", "rachat parts immobilières", "séparation"],
};

export default function SimulateurSoultePage() {
  return (
    <SeoPageShell title="Simulateur de soulte gratuit" ctaLabel="Estimer ma soulte gratuitement">
      <p className="text-lg leading-relaxed">
        Lors d&apos;une séparation, si l&apos;un des co-propriétaires souhaite conserver le logement,
        il doit verser une <strong>soulte</strong> à l&apos;autre pour compenser sa part. Notre
        simulateur estime cette soulte en tenant compte de la valeur du bien, du crédit restant et
        de vos quote-parts.
      </p>
      <h2 className="pt-8 text-2xl font-semibold text-slate-900">Comment est calculée la soulte ?</h2>
      <p>
        La formule de base : <em>Soulte = (Valeur vénale − Dette restante) × Quote-part de l&apos;autre</em>.
        Des frais de notaire peuvent s&apos;ajouter lors du rachat de parts.
      </p>
      <h2 className="pt-6 text-2xl font-semibold text-slate-900">Pour qui ?</h2>
      <ul className="list-disc space-y-2 pl-6">
        <li>Concubins en indivision</li>
        <li>Couples pacsés avec bien immobilier commun</li>
        <li>Époux en séparation ou divorce</li>
      </ul>
    </SeoPageShell>
  );
}
