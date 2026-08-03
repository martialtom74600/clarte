"use client";

import { useState } from "react";
import { Briefcase, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { SimulationResult } from "@separation/schemas";
import { cn } from "@/lib/utils";
import { clarte } from "@/lib/clarte-design";
import { useSeparationStore } from "@/store/separation-store";
import { submitSeparationLead } from "@/lib/separation/export-lead-client";
import styles from "./export-bilan.module.css";

interface ExportPartnerOptInPanelProps {
  result: SimulationResult;
  compact?: boolean;
}

export function ExportPartnerOptInPanel({ result, compact }: ExportPartnerOptInPanelProps) {
  const footprint = useSeparationStore((s) => s.footprint);
  const assumptions = useSeparationStore((s) => s.assumptions);
  const lab = useSeparationStore((s) => s.lab);
  const doorVerdicts = useSeparationStore((s) => s.derived.doorVerdicts);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!fullName.trim()) {
      toast.error("Indiquez votre nom");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Adresse e-mail invalide");
      return;
    }
    if (phone.trim().length < 8) {
      toast.error("Numéro de téléphone requis (8 chiffres minimum)");
      return;
    }
    if (!optIn) {
      toast.error("Cochez la case pour autoriser la mise en relation");
      return;
    }

    setSubmitting(true);
    try {
      const outcome = await submitSeparationLead({
        fullName,
        email,
        phone,
        optInPartnerMatch: true,
        footprint,
        assumptions,
        lab,
        result,
        doorVerdicts,
      });

      if (!outcome.success) {
        toast.error("Transmission impossible", { description: outcome.error });
        return;
      }

      setShareUrl(outcome.shareUrl ?? null);
      setSubmitted(true);

      if (outcome.marketplaceListed) {
        toast.success("Dossier transmis à nos partenaires", {
          description: "Un expert qualifié pourra vous recontacter sous 48 h.",
        });
      } else {
        toast.success("Demande enregistrée", {
          description:
            outcome.marketplaceMessage ??
            "Votre dossier est sauvegardé. Nous vous recontacterons dès qu'un partenaire est disponible.",
        });
      }
    } catch {
      toast.error("Erreur réseau", { description: "Réessayez dans quelques instants." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className={cn(
        styles.sidePanel,
        styles.sidePanelPartner,
        compact && styles.sidePanelCompact
      )}
    >
      {!compact && (
        <div className={styles.sidePanelIconPartner}>
          <Briefcase className="h-5 w-5" aria-hidden />
        </div>
      )}
      <div className="min-w-0 flex-1">
        {!compact && <p className={styles.sidePanelEyebrow}>Passer à l&apos;action</p>}
        <h2 className={styles.sidePanelTitle}>
          {compact ? "Être rappelé par un expert" : "Faire vérifier par un pro"}
        </h2>
        <p className={styles.sidePanelLead}>
          {compact
            ? "Un notaire ou un courtier partenaire peut vous dire si c’est jouable chez vous."
            : "Vos chiffres sont prêts. Un partenaire Clarté (notaire ou courtier) peut les reprendre avec vous pour confirmer si le projet tient — côté banque et côté acte."}
        </p>

        {submitted ? (
          <div className={styles.successBoxPartner}>
            <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden />
            <p className={styles.successTitle}>Demande transmise</p>
            <p className={styles.successBody}>
              Votre dossier a été enregistré. Le PDF reste gratuit — un partenaire Clarté pourra
              vous contacter pour approfondir la faisabilité de votre scénario.
            </p>
            {shareUrl && (
              <p className={styles.shareHint}>
                Lien de partage :{" "}
                <a href={shareUrl} className="text-brand-700 underline">
                  {shareUrl.replace(/^https?:\/\//, "")}
                </a>
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.sidePanelForm}>
            <div className={styles.formGrid}>
              <div>
                <label className={styles.fieldLabelBlock} htmlFor="optin-name">
                  Votre nom
                </label>
                <input
                  id="optin-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Prénom Nom"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className={cn(clarte.input, styles.sidePanelInput)}
                />
              </div>
              <div>
                <label className={styles.fieldLabelBlock} htmlFor="optin-email">
                  Votre e-mail
                </label>
                <input
                  id="optin-email"
                  type="email"
                  autoComplete="email"
                  placeholder="vous@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={cn(clarte.input, styles.sidePanelInput)}
                />
              </div>
            </div>

            <div>
              <label className={styles.fieldLabelBlock} htmlFor="optin-phone">
                Téléphone
              </label>
              <input
                id="optin-phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="06 12 34 56 78"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className={cn(clarte.input, styles.sidePanelInput)}
              />
            </div>

            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={optIn}
                onChange={(event) => setOptIn(event.target.checked)}
                className={styles.checkbox}
              />
              <span>
                J&apos;accepte d&apos;être contacté(e) par un partenaire Clarté (notaire ou
                courtier) pour valider mon projet. Mes données ne seront pas revendues à des tiers
                non partenaires.
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className={cn(clarte.btnPrimary, styles.sidePanelButtonPrimary)}
            >
              {submitting ? "Transmission…" : "Transmettre mon dossier à un expert"}
            </button>

            <p className={styles.legalNote}>
              <ShieldCheck className="inline h-3.5 w-3.5 align-text-bottom" aria-hidden /> Simulation
              indicative — le contact expert ne remplace pas un conseil juridique personnalisé.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
