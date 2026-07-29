import { redirect } from "next/navigation";
import { requirePartnerSession } from "@/lib/partner-auth";
import { CreditPacksGrid } from "@/components/partner/credit-packs-grid";
import { FadeIn } from "@/components/ui";

export default async function PartnerCreditsPage() {
  const session = await requirePartnerSession();
  if (!session) redirect("/pro/login");

  return (
    <FadeIn>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Acheter des crédits</h1>
      <p className="mt-1 text-slate-600">1 crédit = 1 lead exclusif débloqué</p>
      <div className="mt-8">
        <CreditPacksGrid currentBalance={session.partner.credit_balance} />
      </div>
    </FadeIn>
  );
}
