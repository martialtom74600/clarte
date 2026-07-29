import type { ReactNode } from "react";

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

interface ComplexityBadgeProps {
  score: number;
  className?: string;
}

export function ComplexityBadge({ score, className = "" }: ComplexityBadgeProps): ReactNode {
  let label = "Simple";
  let color = "bg-emerald-100 text-emerald-800";

  if (score >= 70) {
    label = "Complexe";
    color = "bg-rose-100 text-rose-800";
  } else if (score >= 40) {
    label = "Modéré";
    color = "bg-amber-100 text-amber-800";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${color} ${className}`}
    >
      {label} ({score}/100)
    </span>
  );
}
