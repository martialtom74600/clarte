import Link from "next/link";
import { ClarteLogo } from "./clarte-logo";
import { clarte } from "@/lib/clarte-design";

const FOOTER_LINKS = [
  { href: "/simulateur-soulte", label: "Simulateur soulte" },
  { href: "/separation-pacs", label: "Séparation PACS" },
  { href: "/concubinage-indivision", label: "Indivision concubinage" },
];

export function ClarteFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200/60 bg-white/50 backdrop-blur-sm">
      <div className={`${clarte.container} py-12`}>
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="mb-4">
              <ClarteLogo size="sm" />
            </div>
            <p className="text-sm text-slate-600">
              Comprenez votre situation patrimoniale en toute sérénité. Simulation indicative,
              sans jugement.
            </p>
          </div>
          <div>
            <h3 className="mb-3 font-semibold">Ressources</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-brand-600">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-3 font-semibold">Confiance</h3>
            <p className="text-sm text-slate-600">
              Données chiffrées RGPD · Approche bienveillante · Sans engagement
            </p>
            <Link href="/pro/login" className="mt-3 inline-block text-sm text-brand-600 hover:underline">
              Espace Pro →
            </Link>
          </div>
        </div>
        <div className="mt-8 border-t border-slate-100 pt-8 text-xs text-slate-500">
          <p>
            Clarté fournit une simulation indicative. Elle ne remplace pas un conseil juridique,
            fiscal ou notarial.
          </p>
        </div>
      </div>
    </footer>
  );
}
