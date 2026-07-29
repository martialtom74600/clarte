import { redirect } from "next/navigation";
import { requirePartnerSession } from "@/lib/partner-auth";
import { getAvailableLeadsForPartner } from "@/lib/supabase";
import { LeadWall } from "@/components/pro/lead-wall";
import { FadeIn } from "@/components/ui";
import { clarteGlassCard } from "@/lib/clarte-design";
import { cn } from "@/lib/utils";

export default async function PartnerLeadsPage() {
  const session = await requirePartnerSession();
  if (!session) redirect("/pro/login");

  const leads = await getAvailableLeadsForPartner(session.partner);

  return (
    <FadeIn>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mur de leads</h1>
        <p className="mt-1 text-slate-600">
          {leads.length} prospect{leads.length !== 1 ? "s" : ""} disponible
          {leads.length !== 1 ? "s" : ""} dans votre zone
        </p>
      </div>

      {leads.length === 0 ? (
        <div className={cn(clarteGlassCard, "border-dashed border-slate-300/80 p-12 text-center text-slate-500")}>
          Aucun lead disponible pour le moment dans vos départements.
        </div>
      ) : (
        <LeadWall
          leads={leads.map((lead) => ({
            id: lead.id,
            preview: lead.preview,
            credit_price: lead.credit_price,
          }))}
        />
      )}
    </FadeIn>
  );
}
