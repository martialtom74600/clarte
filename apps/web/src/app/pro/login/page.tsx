import Link from "next/link";
import { PartnerLoginForm } from "@/components/partner/partner-login-form";

export const metadata = {
  title: "Connexion partenaires — Clarté Pro",
};

export default function PartnerLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 font-bold">
              C
            </div>
            <span className="text-xl font-semibold">Clarté Pro</span>
          </Link>
          <p className="mt-3 text-slate-400 text-sm">Espace partenaires — notaires, courtiers, agences</p>
        </div>
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <h1 className="text-xl font-bold text-slate-900">Connexion</h1>
          <p className="mt-2 text-sm text-slate-600">Magic link envoyé à votre email professionnel.</p>
          <div className="mt-6">
            <PartnerLoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
