"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { FloatingInput, DrawCheck } from "@/components/ui";
import { clarte } from "@/lib/clarte-design";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";

const emailValid = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export function PartnerLoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid(email)) return;

    setLoading(true);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      toast.error("Configuration manquante");
      setLoading(false);
      return;
    }

    const supabase = createBrowserClient(url, key);
    const redirectTo = `${window.location.origin}/pro/auth/callback`;

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    setLoading(false);
    if (authError) {
      toast.error("Accès réservé aux partenaires invités", {
        description: "Contactez Clarté si vous pensez qu'il s'agit d'une erreur.",
      });
      return;
    }
    setSent(true);
    toast.success("Lien envoyé", {
      description: "Consultez votre boîte mail professionnelle.",
    });
  };

  return (
    <AnimatePresence mode="wait">
      {sent ? (
        <motion.div
          key="sent"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={spring.snappy}
          className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-8 text-center backdrop-blur-sm"
        >
          <DrawCheck className="mx-auto h-10 w-10" />
          <p className="mt-4 font-semibold text-emerald-900">Lien envoyé</p>
          <p className="mt-2 text-sm text-emerald-700">
            Consultez votre boîte mail professionnelle pour accéder à Clarté Pro.
          </p>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          onSubmit={handleSubmit}
          className="space-y-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <FloatingInput
            label="Email professionnel"
            type="email"
            value={email}
            onChange={setEmail}
            validate={emailValid}
            hint="Accès sur invitation uniquement. Aucune inscription publique."
          />
          <motion.button
            type="submit"
            disabled={loading || !emailValid(email)}
            whileHover={emailValid(email) ? { scale: 1.008 } : undefined}
            whileTap={emailValid(email) ? { scale: 0.992 } : undefined}
            transition={spring.snappy}
            className={cn("w-full py-3 font-medium disabled:cursor-not-allowed disabled:opacity-40", clarte.btnPrimary)}
          >
            {loading ? "Envoi…" : "Recevoir le lien magique →"}
          </motion.button>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
