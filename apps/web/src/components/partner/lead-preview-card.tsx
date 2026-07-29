import Link from "next/link";
import { scenarioLabel, tierLabel } from "@separation/marketplace";
import type { LeadPreview } from "@separation/marketplace";

interface LeadPreviewCardProps {
  leadId: string;
  preview: LeadPreview;
  creditPrice: number;
}

export function LeadPreviewCard({ leadId, preview, creditPrice }: LeadPreviewCardProps) {
  const tierColors = {
    hot: "bg-rose-100 text-rose-800",
    warm: "bg-amber-100 text-amber-800",
    cold: "bg-slate-100 text-slate-700",
  };

  return (
    <Link
      href={`/pro/leads/${leadId}`}
      className="card-hover block rounded-2xl border border-slate-200 bg-white p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Dept. {preview.dept} • {preview.postal_code_prefix}</p>
          <p className="mt-1 font-semibold text-slate-900 capitalize">{preview.status_relationship}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${tierColors[preview.tier]}`}>
          {tierLabel(preview.tier)}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
        <div>Complexité : <strong>{preview.complexity_score}/100</strong></div>
        <div>Immo : <strong>{preview.has_real_estate ? preview.property_value_range : "Non"}</strong></div>
        <div>Scénario : <strong>{scenarioLabel(preview.scenario)}</strong></div>
        <div>Urgence : <strong>{preview.urgency_months ? `${preview.urgency_months} mois` : "—"}</strong></div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-xs text-slate-500">Expire dans {preview.expires_in_days}j</span>
        <span className="font-semibold text-brand-700">{creditPrice} crédit{creditPrice > 1 ? "s" : ""}</span>
      </div>
    </Link>
  );
}
