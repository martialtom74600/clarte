"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useState } from "react";

export function PartnerLoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      setError("Configuration Supabase manquante.");
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
      setError("Accès réservé aux partenaires invités. Contactez Clarté si vous pensez qu'il s'agit d'une erreur.");
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <p className="font-semibold text-emerald-900">Lien envoyé</p>
        <p className="mt-2 text-sm text-emerald-700">
          Consultez votre boîte mail professionnelle pour accéder à Clarté Pro.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700">Email professionnel</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@etude-notaire.fr"
          className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
        />
        <p className="mt-2 text-xs text-slate-500">
          Accès sur invitation uniquement. Aucune inscription publique.
        </p>
      </div>
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-brand-600 py-3 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? "Envoi..." : "Recevoir le lien de connexion"}
      </button>
    </form>
  );
}
