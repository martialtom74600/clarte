import Link from "next/link";
import { ArrowRight, Shield, Sparkles, Users } from "lucide-react";

export default function HomePage() {
  return (
    <>
      <section className="gradient-hero text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="max-w-2xl">
            <p className="text-brand-200 text-sm font-medium uppercase tracking-wider mb-4">
              Réorganisation patrimoniale
            </p>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Comprenez votre situation financière en 8 minutes
            </h1>
            <p className="mt-6 text-lg text-brand-100">
              Soulte, partage immobilier, dettes et épargne — sans avocat, sans
              jugement, avec des chiffres clairs.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/simulation"
                className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-brand-800 font-semibold hover:bg-brand-50 transition-colors"
              >
                Estimer ma situation
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/simulateur-soulte"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 px-8 py-4 font-medium hover:bg-white/10 transition-colors"
              >
                En savoir plus
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="card-hover rounded-2xl border border-slate-200 bg-white p-8">
            <Sparkles className="h-10 w-10 text-brand-600 mb-4" />
            <h3 className="text-lg font-semibold">Résultat en 90 secondes</h3>
            <p className="mt-2 text-slate-600 text-sm">
              Estimez votre soulte avant même de saisir votre email. Première valeur
              perçue immédiatement.
            </p>
          </div>
          <div className="card-hover rounded-2xl border border-slate-200 bg-white p-8">
            <Users className="h-10 w-10 text-brand-600 mb-4" />
            <h3 className="text-lg font-semibold">Double miroir</h3>
            <p className="mt-2 text-slate-600 text-sm">
              Visualisez la part de chacun en temps réel. Une approche équilibrée,
              pas adversarial.
            </p>
          </div>
          <div className="card-hover rounded-2xl border border-slate-200 bg-white p-8">
            <Shield className="h-10 w-10 text-brand-600 mb-4" />
            <h3 className="text-lg font-semibold">Confidentialité d&apos;abord</h3>
            <p className="mt-2 text-slate-600 text-sm">
              Données sauvegardées localement. Mode discret disponible. RGPD compliant.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white border-y border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="text-2xl font-bold text-slate-900">
            Concubinage, PACS ou Mariage
          </h2>
          <p className="mt-4 text-slate-600 max-w-2xl mx-auto">
            Notre moteur adapte les règles de répartition selon votre statut et régime
            matrimonial.
          </p>
          <Link
            href="/simulation"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-600 px-8 py-4 text-white font-semibold hover:bg-brand-700"
          >
            Démarrer gratuitement
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </>
  );
}
