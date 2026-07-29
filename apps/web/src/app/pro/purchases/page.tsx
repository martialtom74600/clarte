import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerSession } from "@/lib/partner-auth";
import { getPurchasedLeadsForPartner } from "@/lib/supabase";

export default async function PartnerPurchasesPage() {
  const session = await requirePartnerSession();
  if (!session) redirect("/pro/login");

  const purchases = await getPurchasedLeadsForPartner(session.partner.id);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Mes achats</h1>
      <p className="mt-1 text-slate-600">{purchases.length} lead{purchases.length !== 1 ? "s" : ""} débloqué{purchases.length !== 1 ? "s" : ""}</p>

      <div className="mt-8 space-y-4">
        {purchases.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
            Aucun achat pour le moment.{" "}
            <Link href="/pro/leads" className="text-brand-600 hover:underline">Voir le mur de leads</Link>
          </div>
        ) : (
          purchases.map((p: {
            id: string;
            credits_spent: number;
            purchased_at: string;
            marketplace_leads: {
              id: string;
              preview: { dept?: string; tier?: string };
              contact: { email?: string; phone?: string; proof_id?: string };
            };
          }) => {
            const lead = p.marketplace_leads;
            const contact = lead?.contact ?? {};
            return (
              <Link
                key={p.id}
                href={`/pro/purchases/${lead?.id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-6 card-hover"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-slate-900">{contact.email}</p>
                    <p className="text-sm text-slate-600">{contact.phone}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Dept. {lead?.preview?.dept} • {p.credits_spent} crédit(s) •{" "}
                      {new Date(p.purchased_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  {contact.proof_id && (
                    <span className="text-xs font-mono text-brand-600">{contact.proof_id}</span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
