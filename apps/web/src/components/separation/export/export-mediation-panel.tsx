"use client";

import { useState } from "react";
import { Check, Copy, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import type { DoorVerdictMap, SimulationResult } from "@separation/schemas";
import { cn } from "@/lib/utils";
import { clarte } from "@/lib/clarte-design";
import { buildRecipientFacingPack } from "@/lib/separation/invert-for-recipient";
import type {
  AssumptionsState,
  FootprintState,
  LabState,
} from "@/lib/separation/separation-types";
import styles from "./export-bilan.module.css";

interface ExportMediationPanelProps {
  scenarioTitle: string;
  footprint: FootprintState;
  assumptions: AssumptionsState;
  lab: LabState;
  result: SimulationResult;
  doorVerdicts: DoorVerdictMap | null;
  compact?: boolean;
}

export function ExportMediationPanel({
  scenarioTitle,
  footprint,
  assumptions,
  lab,
  result,
  doorVerdicts,
  compact,
}: ExportMediationPanelProps) {
  const [partnerEmail, setPartnerEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const email = partnerEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Adresse e-mail invalide");
      return;
    }

    setSending(true);
    try {
      const recipientPack = buildRecipientFacingPack({
        footprint,
        assumptions,
        lab,
        result,
        doorVerdicts,
      });
      if (!recipientPack) {
        toast.error("Impossible de préparer le bilan pour l'autre personne");
        return;
      }

      const res = await fetch("/api/partage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pack: recipientPack,
          recipientEmail: email,
          senderLabel: "votre partenaire",
        }),
      });
      const data = (await res.json()) as { shareUrl?: string; error?: string };
      if (!res.ok || !data.shareUrl) {
        throw new Error(data.error ?? "partage failed");
      }
      setShareUrl(data.shareUrl);
      toast.success("Lien de partage prêt", {
        description: "Même scénario, formulé pour que « vous » = la personne qui ouvre le lien.",
      });
    } catch {
      toast.error("Impossible de créer le lien", {
        description: "Réessayez dans un instant.",
      });
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Lien copié");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible — sélectionnez le lien à la main");
    }
  }

  return (
    <section
      className={cn(
        styles.sidePanel,
        styles.sidePanelMediation,
        compact && styles.sidePanelCompact
      )}
    >
      {!compact && (
        <div className={styles.sidePanelIcon}>
          <Mail className="h-5 w-5" aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h2 className={styles.sidePanelTitle}>
          {compact ? "Envoyer la simulation" : "En parler à l'autre"}
        </h2>
        <p className={styles.sidePanelLead}>
          {compact
            ? "Même scénario (qui rachète ne change pas), formulé pour qu’elle ou il se reconnaisse dans « vous »."
            : `Créez un lien vers « ${scenarioTitle} ». Même calcul, mêmes rôles — juste écrit pour que l’autre se lise comme « vous ».`}
        </p>

        {shareUrl ? (
          <div className={styles.successBox}>
            <p className={styles.successTitle}>Lien prêt à partager</p>
            <p className={styles.successBody}>
              L&apos;e-mail automatique n&apos;est pas encore branché. Copiez ce lien et
              envoyez-le vous-même (SMS, WhatsApp, mail…).
            </p>
            <p className={styles.shareHint}>{shareUrl.replace(/^https?:\/\//, "")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={cn(clarte.btnPrimary, "inline-flex items-center gap-2 px-4 py-2 text-xs")}
                onClick={() => void copyLink()}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                )}
                {copied ? "Copié" : "Copier le lien"}
              </button>
              <button
                type="button"
                className={cn(clarte.btnGhost, "px-4 py-2 text-xs")}
                onClick={() => {
                  setShareUrl(null);
                  setCopied(false);
                }}
              >
                Créer un autre lien
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSend(e)} className={styles.sidePanelForm}>
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
              className={cn(
                clarte.btnGhost,
                styles.sidePanelButton,
                "inline-flex items-center gap-2"
              )}
            >
              <Send className="h-4 w-4 shrink-0" aria-hidden />
              {sending ? "Création du lien…" : "Créer le lien de partage"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
