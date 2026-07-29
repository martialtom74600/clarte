import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerSession } from "@/lib/partner-auth";
import { Coins, LayoutGrid, ShoppingBag } from "lucide-react";

export default async function PartnerDashboardPage() {
  const session = await requirePartnerSession();
  if (!session) redirect("/pro/login");

  const { partner, user } = session;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">
        Bonjour{user.full_name ? `, ${user.full_name}` : ""}
      </h1>
      <p className="mt-1 text-slate-600">{partner.company_name}</p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <Coins className="h-8 w-8 text-brand-600 mb-3" />
          <p className="text-sm text-slate-500">Solde crédits</p>
          <p className="text-3xl font-bold text-slate-900">{partner.credit_balance}</p>
        </div>
        <Link href="/pro/leads" className="card-hover rounded-2xl border border-slate-200 bg-white p-6 block">
          <LayoutGrid className="h-8 w-8 text-brand-600 mb-3" />
          <p className="font-semibold text-slate-900">Mur de leads</p>
          <p className="mt-1 text-sm text-slate-600">Prospects qualifiés dans votre zone</p>
        </Link>
        <Link href="/pro/purchases" className="card-hover rounded-2xl border border-slate-200 bg-white p-6 block">
          <ShoppingBag className="h-8 w-8 text-brand-600 mb-3" />
          <p className="font-semibold text-slate-900">Mes achats</p>
          <p className="mt-1 text-sm text-slate-600">Contacts débloqués</p>
        </Link>
      </div>

      <div className="mt-8 rounded-2xl bg-brand-50 border border-brand-200 p-6">
        <p className="text-sm text-brand-800">
          Zones actives : {partner.geo_zones.join(", ") || "—"} • Profil : {partner.type}
        </p>
        <Link href="/pro/credits" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">
          Acheter des crédits →
        </Link>
      </div>
    </div>
  );
}
