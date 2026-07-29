import Link from "next/link";
import { Shield, Heart } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white font-bold">
            C
          </div>
          <span className="text-xl font-semibold text-slate-900">Clarté</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
          <Link href="/simulateur-soulte" className="hover:text-brand-600">
            Simulateur soulte
          </Link>
          <Link href="/separation-pacs" className="hover:text-brand-600">
            Séparation PACS
          </Link>
          <Link href="/concubinage-indivision" className="hover:text-brand-600">
            Concubinage
          </Link>
        </nav>
        <Link
          href="/simulation"
          className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          Démarrer
        </Link>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white mt-auto">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-sm">
                C
              </div>
              <span className="font-semibold">Clarté</span>
            </div>
            <p className="text-sm text-slate-600">
              Comprenez votre situation patrimoniale en toute sérénité. Simulation
              indicative, sans jugement.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-3">Ressources</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><Link href="/simulateur-soulte" className="hover:text-brand-600">Simulateur soulte</Link></li>
              <li><Link href="/separation-pacs" className="hover:text-brand-600">Séparation PACS</Link></li>
              <li><Link href="/concubinage-indivision" className="hover:text-brand-600">Indivision concubinage</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-3">Confiance</h3>
            <div className="flex flex-col gap-2 text-sm text-slate-600">
              <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> Données chiffrées RGPD</span>
              <span className="flex items-center gap-2"><Heart className="h-4 w-4" /> Approche bienveillante</span>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-slate-100 pt-8 text-xs text-slate-500">
          <p>
            Clarté fournit une simulation indicative. Elle ne remplace pas un conseil
            juridique, fiscal ou notarial. Consultez un professionnel avant toute décision.
          </p>
        </div>
      </div>
    </footer>
  );
}
