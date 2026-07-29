import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerSession } from "@/lib/partner-auth";
import { getAvailableLeadsForPartner } from "@/lib/supabase";
import { LeadPreviewCard } from "@/components/partner/lead-preview-card";

export default async function PartnerLeadsPage() {
  const session = await requirePartnerSession();
  if (!session) redirect("/pro/login");

  const leads = await getAvailableLeadsForPartner(session.partner);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mur de leads</h1>
          <p className="mt-1 text-slate-600">
            {leads.length} prospect{leads.length !== 1 ? "s" : ""} disponible{leads.length !== 1 ? "s" : ""} dans votre zone
          </p>
        </div>
        <Link
          href="/pro/credits"
          className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          {session.partner.credit_balance} crédits
        </Link>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          Aucun lead disponible pour le moment dans vos départements.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {leads.map((lead) => (
            <LeadPreviewCard
              key={lead.id}
              leadId={lead.id}
              preview={lead.preview}
              creditPrice={lead.credit_price}
            />
          ))}
        </div>
      )}
    </div>
  );
}
