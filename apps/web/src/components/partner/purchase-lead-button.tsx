"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PurchaseLeadButtonProps {
  leadId: string;
  creditPrice: number;
  creditBalance: number;
}

export function PurchaseLeadButton({ leadId, creditPrice, creditBalance }: PurchaseLeadButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePurchase = async () => {
    setLoading(true);
    setError("");

    const res = await fetch(`/api/partner/leads/${leadId}/purchase`, { method: "POST" });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      if (data.error === "INSUFFICIENT_CREDITS") {
        setError("Crédits insuffisants. Rechargez votre solde.");
      } else if (data.error === "LEAD_NOT_AVAILABLE") {
        setError("Ce lead vient d'être acheté par un autre partenaire.");
      } else {
        setError(data.message ?? "Achat impossible.");
      }
      return;
    }

    router.push(`/pro/purchases/${leadId}`);
    router.refresh();
  };

  const canAfford = creditBalance >= creditPrice;

  return (
    <div>
      <button
        type="button"
        onClick={handlePurchase}
        disabled={loading || !canAfford}
        className="w-full rounded-full bg-brand-600 py-3.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Achat en cours..." : `Acheter ce lead — ${creditPrice} crédit${creditPrice > 1 ? "s" : ""}`}
      </button>
      {!canAfford && (
        <p className="mt-2 text-sm text-amber-700">
          Solde insuffisant ({creditBalance} crédit{creditBalance !== 1 ? "s" : ""}).{" "}
          <a href="/pro/credits" className="underline">Recharger</a>
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm text-rose-700">{error}</p>
      )}
    </div>
  );
}
