import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerSession } from "@/lib/partner-auth";
import { getMarketplaceLeadById } from "@/lib/supabase";
import { PurchaseSequence } from "@/components/pro/purchase-sequence";
import { MotionCard, FadeIn } from "@/components/ui";
import { clarte } from "@/lib/clarte-design";
import { scenarioLabel, tierLabel } from "@separation/marketplace";
import { complexityDots, isLeadHot } from "@/lib/lead-utils";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

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
  const hot = isLeadHot(preview);
  const dots = complexityDots(preview.complexity_score);

  return (
    <FadeIn className="max-w-2xl">
      <Link
        href="/pro/leads"
        className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
      >
        ← Retour au mur
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Fiche lead</h1>
      <p className="mt-1 text-slate-600">
        Données qualifiantes — contact masqué jusqu&apos;à l&apos;achat
      </p>

      <MotionCard
        layoutId={`lead-card-${id}`}
        className={cn("mt-8 p-6 space-y-4", hot && `border-amber-400/50 ${clarte.hotPulse}`)}
      >
        <div className="flex justify-between">
          <span className="text-slate-500">Localisation</span>
          <span className="font-medium">
            Dept. {preview.dept} ({preview.postal_code_prefix})
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Tier</span>
          <span className="font-medium">{tierLabel(preview.tier)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-500">Complexité</span>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    i < dots ? "bg-brand-600" : "bg-slate-200"
                  )}
                />
              ))}
            </div>
            <span className="font-medium">{preview.complexity_score}/100</span>
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Statut</span>
          <span className="font-medium capitalize">{preview.status_relationship}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Patrimoine immo</span>
          <span className="font-medium">
            {preview.has_real_estate ? preview.property_value_range : "Non"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Scénario</span>
          <span className="font-medium">{scenarioLabel(preview.scenario)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Enfants mineurs</span>
          <span className="font-medium">{preview.has_minor_children ? "Oui" : "Non"}</span>
        </div>
        <div className="flex justify-between items-center blur-[3px] select-none">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Lock className="h-3.5 w-3.5" />
            Email
          </span>
          <span>••••@••••.fr</span>
        </div>
        <div className="flex justify-between items-center blur-[3px] select-none">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Lock className="h-3.5 w-3.5" />
            Téléphone
          </span>
          <span>06 •• •• •• ••</span>
        </div>
      </MotionCard>

      <div className="mt-8">
        <PurchaseSequence
          leadId={id}
          creditPrice={lead.credit_price}
          creditBalance={session.partner.credit_balance}
        />
      </div>
      <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-slate-400">
        Achat exclusif — 1 seul partenaire
      </p>
    </FadeIn>
  );
}
