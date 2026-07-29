import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerSession } from "@/lib/partner-auth";
import { getMarketplaceLeadById } from "@/lib/supabase";
import { PurchaseLeadButton } from "@/components/partner/purchase-lead-button";
import { scenarioLabel, tierLabel } from "@separation/marketplace";

export default async function PartnerLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePartnerSession();
  if (!session) redirect("/pro/login");

  const { id } = await params;
  const lead = await getMarketplaceLeadById(id);
  if (!lead || lead.status !== "available") {
    redirect("/pro/leads");
  }

  const preview = lead.preview;

  return (
    <div className="max-w-2xl">
      <Link href="/pro/leads" className="text-sm text-brand-600 hover:underline">
        ← Retour au mur
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Fiche lead</h1>
      <p className="mt-1 text-slate-600">Données qualifiantes — contact masqué jusqu&apos;à l&apos;achat</p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex justify-between">
          <span className="text-slate-500">Localisation</span>
          <span className="font-medium">Dept. {preview.dept} ({preview.postal_code_prefix})</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Tier</span>
          <span className="font-medium">{tierLabel(preview.tier)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Complexité</span>
          <span className="font-medium">{preview.complexity_score}/100</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Statut</span>
          <span className="font-medium capitalize">{preview.status_relationship}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Patrimoine immo</span>
          <span className="font-medium">{preview.has_real_estate ? preview.property_value_range : "Non"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Scénario</span>
          <span className="font-medium">{scenarioLabel(preview.scenario)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Enfants mineurs</span>
          <span className="font-medium">{preview.has_minor_children ? "Oui" : "Non"}</span>
        </div>
        <div className="flex justify-between blur-sm select-none">
          <span className="text-slate-500">Email</span>
          <span>••••@••••.fr</span>
        </div>
        <div className="flex justify-between blur-sm select-none">
          <span className="text-slate-500">Téléphone</span>
          <span>06 •• •• •• ••</span>
        </div>
      </div>

      <div className="mt-8">
        <PurchaseLeadButton
          leadId={id}
          creditPrice={lead.credit_price}
          creditBalance={session.partner.credit_balance}
        />
      </div>
      <p className="mt-4 text-xs text-slate-500 text-center">
        Achat exclusif — ce lead ne sera vendu qu&apos;à un seul partenaire.
      </p>
    </div>
  );
}
