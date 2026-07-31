"use client";

import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { clarte } from "@/lib/clarte-design";
import styles from "./export-bilan.module.css";

interface ExportMediationPanelProps {
  scenarioTitle: string;
}

export function ExportMediationPanel({ scenarioTitle }: ExportMediationPanelProps) {
  const [partnerEmail, setPartnerEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const email = partnerEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Adresse e-mail invalide");
      return;
    }

    setSending(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setSending(false);
    setSent(true);
    toast.success("Simulation envoyée", {
      description: `Un lien vers « ${scenarioTitle} » a été préparé pour ${email}.`,
    });
  }

  return (
    <section className={cn(styles.sidePanel, styles.sidePanelMediation)}>
      <div className={styles.sidePanelIcon}>
        <Mail className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className={styles.sidePanelTitle}>Transparence &amp; Médiation</h2>
        <p className={styles.sidePanelLead}>
          Clarté encourage le partage de l&apos;information entre les deux parties. Envoyez cette
          simulation à l&apos;autre personne pour avancer ensemble, sur la même base de chiffres.
        </p>

        {sent ? (
          <div className={styles.successBox}>
            <p className={styles.successTitle}>Envoi simulé avec succès</p>
            <p className={styles.successBody}>
              En production, un e-mail contenant le lien de partage et le récapitulatif PDF sera
              adressé à votre co-parent ou ex-conjoint(e).
            </p>
            <button
              type="button"
              className={cn(clarte.btnGhost, "mt-3 px-4 py-2 text-xs")}
              onClick={() => setSent(false)}
            >
              Envoyer à une autre adresse
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className={styles.sidePanelForm}>
            <label className={styles.fieldLabelBlock} htmlFor="mediation-email">
              E-mail de l&apos;autre personne
            </label>
            <input
              id="mediation-email"
              type="email"
              autoComplete="email"
              placeholder="ex. conjoint@email.com"
              value={partnerEmail}
              onChange={(event) => setPartnerEmail(event.target.value)}
              className={cn(clarte.input, styles.sidePanelInput)}
            />
            <button
              type="submit"
              disabled={sending}
              className={cn(clarte.btnGhost, styles.sidePanelButton, "gap-2")}
            >
              <Send className="h-4 w-4" aria-hidden />
              {sending ? "Envoi en cours…" : "Envoyer la simulation par e-mail"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
