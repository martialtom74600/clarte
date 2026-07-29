import Link from "next/link";
import { PartnerLoginForm } from "@/components/partner/partner-login-form";
import { FadeIn } from "@/components/ui";
import { clarte } from "@/lib/clarte-design";

export const metadata = {
  title: "Connexion partenaires — Clarté Pro",
};

export default function PartnerLoginPage() {
  return (
    <div className={`${clarte.surfaceDark} flex min-h-screen items-center justify-center px-4`}>
      <FadeIn className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 font-bold shadow-lg shadow-brand-500/30">
              C
            </div>
            <span className="text-xl font-semibold tracking-tight">Clarté Pro</span>
          </Link>
          <p className="mt-3 text-sm text-slate-400">
            Espace partenaire privé — notaires, courtiers, agences
          </p>
        </div>
        <div className={`${clarte.glass} rounded-2xl p-8`}>
          <h1 className="text-xl font-bold text-slate-900">Connexion</h1>
          <p className="mt-2 text-sm text-slate-600">
            Magic link envoyé à votre email professionnel.
          </p>
          <div className="mt-6">
            <PartnerLoginForm />
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">Accès sur invitation uniquement</p>
      </FadeIn>
    </div>
  );
}
