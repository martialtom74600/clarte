"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CREDIT_PACKS } from "@separation/marketplace";
import { scaleTap, spring } from "@/lib/motion";
import { clarteGlassCard } from "@/lib/clarte-design";

export function CreditPacksGrid({ currentBalance }: { currentBalance: number }) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleBuy = async (packId: string) => {
    setLoading(packId);
    const res = await fetch("/api/partner/credits/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packId }),
    });
    const data = await res.json();
    setLoading(null);

    if (data.url) {
      toast.info("Redirection Stripe…");
      window.location.href = data.url;
    } else {
      toast.error("Impossible de démarrer le paiement");
    }
  };

  return (
    <div>
      <p className="mb-6 text-slate-600">
        Solde actuel :{" "}
        <strong className="text-slate-900">{currentBalance} crédits</strong>
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {CREDIT_PACKS.map((pack, i) => (
          <motion.div
            key={pack.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, ...spring.soft }}
            className={`${clarteGlassCard} p-6`}
          >
            <p className="font-semibold text-slate-900">{pack.label}</p>
            <p className="mt-2 text-3xl font-bold text-brand-700">
              {(pack.priceCents / 100).toLocaleString("fr-FR")} €
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {pack.credits} crédits · ~{Math.round(pack.priceCents / pack.credits / 100)} €/lead
            </p>
            <motion.button
              type="button"
              onClick={() => handleBuy(pack.id)}
              disabled={loading === pack.id}
              {...scaleTap}
              className="mt-4 w-full rounded-full bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {loading === pack.id ? "Redirection…" : "Acheter"}
            </motion.button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
