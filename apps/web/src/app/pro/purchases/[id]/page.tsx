import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerSession } from "@/lib/partner-auth";
import { getMarketplaceLeadById, getPurchasedLeadsForPartner } from "@/lib/supabase";
import { FadeIn } from "@/components/ui";
import { clarteGlassCard } from "@/lib/clarte-design";
import { cn, formatEuro } from "@/lib/utils";

export default async function PartnerPurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePartnerSession();
  if (!session) redirect("/pro/login");

  const { id } = await params;
  const purchases = await getPurchasedLeadsForPartner(session.partner.id);
  const owned = purchases.find(
    (p: { marketplace_leads: { id: string } }) => p.marketplace_leads?.id === id
  );

  if (!owned) redirect("/pro/leads");

  const lead = await getMarketplaceLeadById(id);
  const contact = (lead?.contact ?? {}) as {
    email?: string;
    phone?: string;
    proof_id?: string;
    pdf_url?: string;
    share_token?: string;
    simulation_summary?: Record<string, unknown>;
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const pdfLink = contact.pdf_url ?? (contact.share_token ? `${appUrl}/partage/${contact.share_token}` : null);

  return (
    <FadeIn className="max-w-2xl">
      <Link href="/pro/purchases" className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
        ← Mes achats
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Contact débloqué</h1>

      <div className="mt-8 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6 space-y-4">
        <div>
          <p className="text-sm text-emerald-700">Email</p>
          <a href={`mailto:${contact.email}`} className="text-lg font-semibold text-emerald-900">
            {contact.email}
          </a>
        </div>
        <div>
          <p className="text-sm text-emerald-700">Téléphone</p>
          <a href={`tel:${contact.phone}`} className="text-lg font-semibold text-emerald-900">
            {contact.phone}
          </a>
        </div>
        {contact.proof_id && (
          <div>
            <p className="text-sm text-emerald-700">Preuve instant T</p>
            <p className="font-mono font-semibold text-emerald-900">{contact.proof_id}</p>
          </div>
        )}
        {pdfLink && (
          <div>
            <p className="text-sm text-emerald-700">Rapport PDF</p>
            <a href={pdfLink} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline">
              Ouvrir le rapport horodaté
            </a>
          </div>
        )}
      </div>

      {contact.simulation_summary && (
        <div className={cn(clarteGlassCard, "mt-6 space-y-2 p-6 text-sm")}>
          <p className="font-semibold text-slate-900">Résumé simulation</p>
          {"soulteAmount" in contact.simulation_summary && contact.simulation_summary.soulteAmount != null && (
            <p>Soulte estimée : {formatEuro(contact.simulation_summary.soulteAmount as number)}</p>
          )}
          {"complexityScore" in contact.simulation_summary && (
            <p>Complexité : {contact.simulation_summary.complexityScore as number}/100</p>
          )}
          {"netWorthA" in contact.simulation_summary && (
            <p>
              Patrimoine A : {formatEuro(contact.simulation_summary.netWorthA as number)} • B :{" "}
              {formatEuro(contact.simulation_summary.netWorthB as number)}
            </p>
          )}
        </div>
      )}
    </FadeIn>
  );
}
