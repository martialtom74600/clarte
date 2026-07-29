"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Copy, Phone } from "lucide-react";
import { DrawCheck } from "@/components/ui";
import { clarteGlassCard } from "@/lib/clarte-design";
import { cn } from "@/lib/utils";
import { duration, ease, spring } from "@/lib/motion";

type Phase = "idle" | "confirm" | "processing" | "reveal";

interface PurchaseSequenceProps {
  leadId: string;
  creditPrice: number;
  creditBalance: number;
}

interface UnlockedContact {
  email?: string;
  phone?: string | null;
}

function ConfettiBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-brand-400/40"
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{
            x: (i % 2 === 0 ? 1 : -1) * (20 + i * 12),
            y: -30 - i * 8,
            opacity: 0,
          }}
          transition={{ duration: 0.6, ease: ease.out }}
        />
      ))}
    </div>
  );
}

export function PurchaseSequence({
  leadId,
  creditPrice,
  creditBalance,
}: PurchaseSequenceProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [contact, setContact] = useState<UnlockedContact | null>(null);
  const canAfford = creditBalance >= creditPrice;

  const executePurchase = useCallback(async () => {
    setPhase("processing");
    setError("");

    const res = await fetch(`/api/partner/leads/${leadId}/purchase`, { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      setPhase("idle");
      if (data.error === "INSUFFICIENT_CREDITS") {
        setError("Crédits insuffisants. Rechargez votre solde.");
        toast.error("Crédits insuffisants", {
          description: "Rechargez pour débloquer ce lead.",
          action: { label: "Recharger →", onClick: () => router.push("/pro/credits") },
        });
      } else if (data.error === "LEAD_NOT_AVAILABLE") {
        setError("Ce lead vient d'être acheté par un autre partenaire.");
        toast.error("Lead indisponible", { description: "Un autre partenaire l'a acquis." });
      } else {
        setError(data.message ?? "Achat impossible.");
        toast.error("Achat impossible");
      }
      return;
    }

    setContact(data.contact ?? {});
    setPhase("reveal");

    toast.success("Lead acquis", {
      description: `Contact débloqué · ${creditBalance - creditPrice} crédits restants`,
    });

    setTimeout(() => {
      router.push(`/pro/purchases/${leadId}`);
      router.refresh();
    }, 1200);
  }, [leadId, creditBalance, creditPrice, router]);

  useEffect(() => {
    if (phase !== "confirm") return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executePurchase();
      }
      if (e.key === "Escape") {
        setPhase("idle");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, executePurchase]);

  useEffect(() => {
    if (phase !== "reveal" || !contact?.email) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "c" || e.key === "C") {
        if (contact.email) {
          navigator.clipboard.writeText(contact.email);
          toast.success("Email copié");
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, contact]);

  const copyEmail = () => {
    if (contact?.email) {
      navigator.clipboard.writeText(contact.email);
      toast.success("Email copié");
    }
  };

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {phase === "reveal" && contact && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(clarteGlassCard, "relative overflow-hidden p-6")}
          >
            <ConfettiBurst />
            <div className="flex items-center gap-3">
              <DrawCheck className="h-8 w-8" />
              <div>
                <p className="font-semibold text-slate-900">Lead acquis</p>
                <p className="text-sm text-slate-500">Contact débloqué</p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <motion.div
                initial={{ opacity: 0, filter: "blur(12px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                transition={{ delay: 0.1, duration: duration.slow, ease: ease.out }}
                className="rounded-xl bg-slate-50 px-4 py-3"
              >
                <p className="text-xs text-slate-500">Email</p>
                <p className="font-medium text-slate-900">{contact.email}</p>
              </motion.div>
              {contact.phone && (
                <motion.div
                  initial={{ opacity: 0, filter: "blur(12px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{ delay: 0.2, duration: duration.slow, ease: ease.out }}
                  className="rounded-xl bg-slate-50 px-4 py-3"
                >
                  <p className="text-xs text-slate-500">Téléphone</p>
                  <p className="font-medium text-slate-900">{contact.phone}</p>
                </motion.div>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={copyEmail}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Copy className="h-4 w-4" />
                Copier (C)
              </button>
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
                >
                  <Phone className="h-4 w-4" />
                  Appeler
                </a>
              )}
            </div>
            <p className="mt-4 text-center text-xs text-slate-400">
              Redirection vers votre contact…
            </p>
          </motion.div>
        )}

        {phase === "processing" && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(clarteGlassCard, "p-6 text-center")}
          >
            <motion.div
              className="mx-auto h-8 w-8 rounded-full border-2 border-brand-200 border-t-brand-600"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
            <p className="mt-4 font-medium text-slate-900">Achat en cours…</p>
            <motion.div
              className="mt-4 h-0.5 overflow-hidden rounded-full bg-slate-100"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="h-full bg-brand-600"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1, ease: ease.out }}
              />
            </motion.div>
          </motion.div>
        )}

        {phase === "confirm" && (
          <motion.div
            key="confirm"
            layoutId="purchase-cta"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(clarteGlassCard, "space-y-4 p-6")}
          >
            <p className="font-medium text-slate-900">Confirmer l&apos;achat exclusif ?</p>
            <p className="text-sm text-slate-500">
              {creditPrice} crédit{creditPrice > 1 ? "s" : ""} · ce lead ne sera vendu qu&apos;à
              un seul partenaire.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPhase("idle")}
                className="flex-1 rounded-full border border-slate-200 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Annuler (Esc)
              </button>
              <button
                type="button"
                onClick={executePurchase}
                className="flex-1 rounded-full bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Confirmer (↵)
              </button>
            </div>
          </motion.div>
        )}

        {phase === "idle" && (
          <motion.div key="idle" layoutId="purchase-cta">
            <motion.button
              type="button"
              onClick={() => (canAfford ? setPhase("confirm") : undefined)}
              disabled={!canAfford}
              whileHover={canAfford ? { scale: 1.008 } : undefined}
              whileTap={canAfford ? { scale: 0.992 } : undefined}
              transition={spring.snappy}
              className={cn(
                "w-full rounded-full py-3.5 font-semibold text-white transition-colors",
                canAfford
                  ? "bg-brand-600 hover:bg-brand-700"
                  : "cursor-not-allowed bg-slate-300"
              )}
            >
              Acheter ce lead — {creditPrice} crédit{creditPrice > 1 ? "s" : ""}
            </motion.button>
            {!canAfford && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, x: [0, -4, 4, -4, 0] }}
                transition={{ x: { duration: 0.2 } }}
                className="mt-2 text-sm text-amber-700"
              >
                Solde insuffisant ({creditBalance} crédit{creditBalance !== 1 ? "s" : ""}).{" "}
                <a href="/pro/credits" className="underline">
                  Recharger
                </a>
              </motion.p>
            )}
            {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
