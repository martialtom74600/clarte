"use client";

import type { SimulationInput, SimulationResult } from "@separation/schemas";
import type {
  CashflowResult,
  ChildSupportResult,
  PatrimonyImbalance,
  ResolutionComparison,
} from "@separation/engine";
import {
  AlertTriangle,
  BarChart3,
  FileBadge,
  GitCompare,
  Handshake,
  Mail,
  PieChart,
  Scale,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { ComplexityBadge } from "@separation/ui";
import { FloatingInput, OptInCard, StaggerItem, StaggerList, TrustStrip } from "@/components/ui";
import {
  DoubleMirror,
  PatrimonyChart,
  ScenarioCards,
  WowMoment,
} from "@/components/simulation-charts";
import {
  CashflowPanel,
  ChildSupportPanel,
  ImbalanceAlert,
  MediationLinkPanel,
  ResolutionCompare,
} from "./pain-point-panels";
import { DossierCard } from "./dossier-cards";
import { InputField, SelectCard } from "./wizard-ui";
import { clarte, clarteFocusRing } from "@/lib/clarte-design";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  concubinage: "Concubinage",
  pacs: "PACS",
  marriage: "Mariage",
};

const REGIME_LABELS: Record<string, string> = {
  communaute_legale: "Communauté légale",
  separation_biens: "Séparation de biens",
  communaute_universelle: "Communauté universelle",
};

export interface LegalStatusSectionProps {
  status: SimulationInput["status"] | null;
  marriageRegime: SimulationInput["marriageRegime"];
  marriageDate: string;
  pacsDate: string;
  onStatusChange: (status: SimulationInput["status"]) => void;
  onMarriageRegimeChange: (regime: SimulationInput["marriageRegime"]) => void;
  onMarriageDateChange: (value: string) => void;
  onPacsDateChange: (value: string) => void;
}

export function LegalStatusSection({
  status,
  marriageRegime,
  marriageDate,
  pacsDate,
  onStatusChange,
  onMarriageRegimeChange,
  onMarriageDateChange,
  onPacsDateChange,
}: LegalStatusSectionProps) {
  const summary = status
    ? [
        STATUS_LABELS[status],
        status === "marriage" && marriageRegime
          ? REGIME_LABELS[marriageRegime]
          : undefined,
        status === "marriage" && marriageDate
          ? `Mariage le ${new Date(marriageDate).toLocaleDateString("fr-FR")}`
          : undefined,
        status === "pacs" && pacsDate
          ? `PACS le ${new Date(pacsDate).toLocaleDateString("fr-FR")}`
          : undefined,
      ].filter(Boolean) as string[]
    : ["Statut à sélectionner"];

  return (
    <StaggerList className="space-y-4">
      <StaggerItem>
        <DossierCard
          title="Statut juridique"
          description="Détermine le cadre de répartition patrimoniale applicable à votre situation."
          icon={Scale}
          complete={Boolean(status)}
          summary={summary}
        >
          <div className="space-y-3">
            <SelectCard
              label="Concubinage"
              description="Vie commune sans PACS ni mariage. Indivision par défaut."
              selected={status === "concubinage"}
              onClick={() => onStatusChange("concubinage")}
            />
            <SelectCard
              label="PACS"
              description="Séparation de biens de plein droit, sauf convention contraire."
              selected={status === "pacs"}
              onClick={() => onStatusChange("pacs")}
            />
            <SelectCard
              label="Mariage"
              description="Régime matrimonial applicable (communauté légale par défaut)."
              selected={status === "marriage"}
              onClick={() => onStatusChange("marriage")}
            />
          </div>

          {status === "marriage" && (
            <div className="space-y-4 border-t border-slate-100 pt-5">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Régime matrimonial</span>
                <select
                  value={marriageRegime}
                  onChange={(e) =>
                    onMarriageRegimeChange(e.target.value as SimulationInput["marriageRegime"])
                  }
                  className={cn(
                    "mt-2 w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 text-slate-900 outline-none transition-shadow",
                    clarteFocusRing
                  )}
                >
                  <option value="communaute_legale">Communauté légale</option>
                  <option value="separation_biens">Séparation de biens</option>
                  <option value="communaute_universelle">Communauté universelle</option>
                </select>
              </label>
              <InputField
                label="Date de mariage"
                type="date"
                value={marriageDate}
                onChange={onMarriageDateChange}
                optional
              />
            </div>
          )}

          {status === "pacs" && (
            <div className="border-t border-slate-100 pt-5">
              <InputField
                label="Date du PACS"
                type="date"
                value={pacsDate}
                onChange={onPacsDateChange}
                optional
              />
            </div>
          )}
        </DossierCard>
      </StaggerItem>
    </StaggerList>
  );
}

export function EstimationResultsSection({
  result,
  imbalance,
  childSupport,
}: {
  result: SimulationResult;
  imbalance?: PatrimonyImbalance;
  childSupport?: ChildSupportResult;
}) {
  return (
    <StaggerList className="space-y-4">
      <StaggerItem>
        <DossierCard
          title="Synthèse patrimoniale"
          description="Projection calculée sur l'ensemble de votre dossier patrimonial."
          icon={BarChart3}
          collapsible={false}
          complete
        >
          <WowMoment result={result} />
        </DossierCard>
      </StaggerItem>

      <StaggerItem>
        <DossierCard
          title="Répartition par personne"
          description="Patrimoine net estimé pour chaque partie."
          icon={Users}
          collapsible={false}
          complete
        >
          <DoubleMirror result={result} />
        </DossierCard>
      </StaggerItem>

      <StaggerItem>
        <DossierCard
          title="Visualisation"
          description="Répartition graphique du patrimoine net consolidé."
          icon={PieChart}
          collapsible={false}
          defaultExpanded={false}
          complete
        >
          <PatrimonyChart result={result} />
        </DossierCard>
      </StaggerItem>

      {imbalance && (
        <StaggerItem>
          <DossierCard
            title="Points d'attention"
            description="Éléments à surveiller dans la négociation."
            icon={AlertTriangle}
            collapsible={false}
            complete
          >
            <ImbalanceAlert imbalance={imbalance} />
          </DossierCard>
        </StaggerItem>
      )}

      {childSupport && (
        <StaggerItem>
          <DossierCard
            title="Pension alimentaire indicative"
            description="Estimation basée sur vos revenus et la garde déclarés."
            icon={Users}
            collapsible={false}
            complete
          >
            <ChildSupportPanel support={childSupport} embedded />
          </DossierCard>
        </StaggerItem>
      )}

      {result.warnings.length > 0 && (
        <StaggerItem>
          <DossierCard
            title="Avertissements"
            description="Limites et réserves de la simulation."
            icon={AlertTriangle}
            collapsible={false}
            defaultExpanded={false}
          >
            <div className="space-y-2">
              {result.warnings.map((w) => (
                <div
                  key={w.code}
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                >
                  {w.message}
                </div>
              ))}
            </div>
          </DossierCard>
        </StaggerItem>
      )}
    </StaggerList>
  );
}

/** Acte 3 — Révélation : projection complète + scénarios sur un seul écran. */
export function RevelationSection({
  result,
  imbalance,
  childSupport,
  cashflow,
  selectedScenario,
  onSelectScenario,
}: {
  result: SimulationResult;
  imbalance?: PatrimonyImbalance;
  childSupport?: ChildSupportResult;
  cashflow?: CashflowResult;
  selectedScenario?: SimulationInput["options"]["scenario"];
  onSelectScenario: (scenario: SimulationInput["options"]["scenario"]) => void;
}) {
  return (
    <div className="space-y-4">
      <EstimationResultsSection
        result={result}
        imbalance={imbalance}
        childSupport={childSupport}
      />
      <ScenarioCompareSection
        result={result}
        selectedScenario={selectedScenario}
        cashflow={cashflow}
        onSelectScenario={onSelectScenario}
      />
    </div>
  );
}

/** Acte 4 — Hub unique : sécuriser le dossier et choisir ses options. */
export function SecureActHubSection({
  result,
  email,
  phone,
  emailSent,
  urgencyMonths,
  mediationLink,
  optInPartnerMatch,
  resolution,
  onEmailChange,
  onPhoneChange,
  onSendReport,
  onUrgencyChange,
  onGenerateMediation,
  onOptInChange,
  onPublishPartner,
  onPremiumCheckout,
  onRestart,
}: {
  result: SimulationResult;
  email: string;
  phone: string;
  emailSent: boolean;
  urgencyMonths: number | null;
  mediationLink?: string;
  optInPartnerMatch: boolean;
  resolution?: ResolutionComparison;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSendReport: () => void;
  onUrgencyChange: (value: number | null) => void;
  onGenerateMediation: () => void;
  onOptInChange: (value: boolean) => void;
  onPublishPartner: () => void;
  onPremiumCheckout: () => void;
  onRestart: () => void;
}) {
  const emailValid = email.includes("@");

  return (
    <StaggerList className="space-y-4">
      <StaggerItem>
        <DossierCard
          title="Confidentialité"
          description="Vos données restent sous votre contrôle."
          icon={Mail}
          collapsible={false}
          complete
        >
          <TrustStrip />
        </DossierCard>
      </StaggerItem>

      <StaggerItem>
        <DossierCard
          title="Rapport PDF horodaté"
          description="Photographie financière certifiée — preuve d'instant T."
          icon={Mail}
          complete={emailSent}
          summary={[
            emailSent
              ? `Envoyé à ${email}`
              : emailValid
                ? `Prêt pour ${email}`
                : "Email à renseigner",
          ]}
        >
          <div className="rounded-xl border border-brand-200/60 bg-brand-50/50 px-4 py-3 text-sm text-brand-800">
            Identifiant unique de preuve inclus pour sécuriser vos échanges en médiation.
          </div>
          <FloatingInput
            label="Votre email"
            type="email"
            value={email}
            onChange={onEmailChange}
            validate={(v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)}
            hint="Nous ne partageons jamais votre email sans votre accord."
          />
          <InputField
            label="Téléphone mobile"
            type="tel"
            value={phone}
            onChange={onPhoneChange}
            placeholder="06 12 34 56 78"
            optional
            hint="Utile si vous activez la mise en relation pro."
          />
          <button
            type="button"
            onClick={onSendReport}
            disabled={!emailValid || emailSent}
            className={cn(
              "w-full px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40",
              clarte.btnPrimary
            )}
          >
            {emailSent ? "Rapport envoyé" : "Recevoir mon rapport certifié"}
          </button>
        </DossierCard>
      </StaggerItem>

      <StaggerItem>
        <DossierCard
          title="Affinage du dossier"
          description="Horizon décisionnel — optionnel."
          icon={SlidersHorizontal}
          defaultExpanded={false}
          summary={[
            urgencyMonths
              ? `Décision sous ${urgencyMonths} mois`
              : "Non renseigné",
          ]}
        >
          <InputField
            label="Urgence (mois avant décision)"
            type="number"
            value={urgencyMonths ?? ""}
            onChange={(v) => onUrgencyChange(Number(v) || null)}
            optional
          />
        </DossierCard>
      </StaggerItem>

      <StaggerItem>
        <DossierCard
          title="Médiation asynchrone"
          description="Lien neutre à partager — aligner les chiffres sans confrontation."
          icon={Handshake}
          complete={Boolean(mediationLink)}
          defaultExpanded={!mediationLink}
          summary={[mediationLink ? "Lien généré" : "Non généré"]}
        >
          <MediationLinkPanel onGenerate={onGenerateMediation} link={mediationLink} embedded />
        </DossierCard>
      </StaggerItem>

      {resolution && (
        <StaggerItem>
          <DossierCard
            title="Amiable vs contentieux"
            description="Comparaison des coûts et délais estimés."
            icon={GitCompare}
            collapsible={false}
            defaultExpanded={false}
            complete
          >
            <ResolutionCompare
              comparison={resolution}
              onChooseAmiable={() => onOptInChange(true)}
              embedded
            />
          </DossierCard>
        </StaggerItem>
      )}

      <StaggerItem>
        <DossierCard
          title="Mise en relation professionnelle"
          description="Notaire, courtier ou agence — opt-in explicite."
          icon={Handshake}
          complete={optInPartnerMatch && Boolean(phone.trim())}
          summary={[
            optInPartnerMatch
              ? phone.trim()
                ? "Opt-in activé"
                : "Téléphone requis"
              : "Non activé",
          ]}
        >
          <ComplexityBadge score={result.complexityScore} />
          <div className="mt-4">
            <OptInCard
              checked={optInPartnerMatch}
              onChange={onOptInChange}
              title="Je souhaite être mis en relation avec un professionnel"
              description="Sans engagement — contact sous 48h ouvrées."
            />
          </div>
          {optInPartnerMatch && (
            <>
              { !phone.trim() && (
                <p className="mt-3 text-sm text-amber-800">
                  Renseignez votre téléphone dans la carte Rapport PDF ci-dessus.
                </p>
              )}
              <button
                type="button"
                onClick={onPublishPartner}
                disabled={!phone.trim() || !emailValid}
                className={cn(
                  "mt-4 w-full px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40",
                  clarte.btnPrimary
                )}
              >
                Activer la mise en relation
              </button>
            </>
          )}
        </DossierCard>
      </StaggerItem>

      <StaggerItem>
        <DossierCard
          title="Rapport premium"
          description="Export complet · scénarios illimités · médiation avancée"
          icon={FileBadge}
          collapsible={false}
          complete
        >
          <ul className="space-y-2 text-sm text-slate-700">
            <li>✓ PDF détaillé avec tous les scénarios</li>
            <li>✓ Historique et modifications illimitées</li>
            <li>✓ Lien partageable pour médiation</li>
          </ul>
          <div className="mt-4 rounded-xl border border-brand-200/60 bg-brand-50/40 px-5 py-3">
            <span className="text-2xl font-bold text-brand-800">29 €</span>
          </div>
          <button
            type="button"
            onClick={onPremiumCheckout}
            disabled={!emailValid}
            className={cn(
              "mt-4 w-full px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40",
              clarte.btnPrimary
            )}
          >
            Obtenir le rapport premium
          </button>
        </DossierCard>
      </StaggerItem>

      <StaggerItem>
        <button
          type="button"
          onClick={onRestart}
          className="text-sm text-slate-500 transition-colors hover:text-brand-600"
        >
          Recommencer une simulation
        </button>
      </StaggerItem>
    </StaggerList>
  );
}

export function ScenarioCompareSection({
  result,
  selectedScenario,
  cashflow,
  onSelectScenario,
}: {
  result: SimulationResult;
  selectedScenario?: SimulationInput["options"]["scenario"];
  cashflow?: CashflowResult;
  onSelectScenario: (scenario: SimulationInput["options"]["scenario"]) => void;
}) {
  return (
    <StaggerList className="space-y-4">
      <StaggerItem>
        <DossierCard
          title="Scénarios de sortie"
          description="Comparez rachat, vente et autres modalités de liquidation."
          icon={GitCompare}
          collapsible={false}
          complete={Boolean(selectedScenario)}
        >
          <ScenarioCards
            result={result}
            selectedScenario={selectedScenario}
            onSelect={(scenario) =>
              onSelectScenario(scenario as SimulationInput["options"]["scenario"])
            }
          />
        </DossierCard>
      </StaggerItem>

      {cashflow && (
        <StaggerItem>
          <DossierCard
            title="Budget mensuel post-séparation"
            description="Impact projeté sur le niveau de vie de chaque partie."
            icon={BarChart3}
            collapsible={false}
            defaultExpanded={false}
            complete
          >
            <CashflowPanel cashflow={cashflow} embedded />
          </DossierCard>
        </StaggerItem>
      )}
    </StaggerList>
  );
}

export function ReportCaptureSection({
  email,
  phone,
  onEmailChange,
  onPhoneChange,
}: {
  email: string;
  phone: string;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
}) {
  const complete = email.includes("@");

  return (
    <StaggerList className="space-y-4">
      <StaggerItem>
        <DossierCard
          title="Confidentialité"
          description="Vos données sont protégées tout au long du parcours."
          icon={Mail}
          collapsible={false}
          complete
        >
          <TrustStrip />
        </DossierCard>
      </StaggerItem>

      <StaggerItem>
        <DossierCard
          title="Coordonnées"
          description="Pour recevoir votre rapport PDF horodaté et certifié."
          icon={Mail}
          complete={complete}
          summary={[
            complete ? `Email : ${email}` : "Email à renseigner",
            phone ? `Téléphone : ${phone}` : "Téléphone optionnel",
          ]}
        >
          <div className="rounded-xl border border-brand-200/60 bg-brand-50/50 px-4 py-3 text-sm text-brand-800">
            Votre rapport inclura un identifiant unique de preuve (instant T) pour sécuriser vos
            échanges.
          </div>
          <FloatingInput
            label="Votre email"
            type="email"
            value={email}
            onChange={onEmailChange}
            validate={(v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)}
            hint="Nous ne partageons jamais votre email sans votre accord."
          />
          <InputField
            label="Téléphone mobile"
            type="tel"
            value={phone}
            onChange={onPhoneChange}
            placeholder="06 12 34 56 78"
            optional
            hint="Pour qu'un professionnel puisse vous conseiller si vous le souhaitez — jamais partagé sans votre accord explicite."
          />
        </DossierCard>
      </StaggerItem>
    </StaggerList>
  );
}

export function RefinementSection({
  urgencyMonths,
  mediationLink,
  resolution,
  onUrgencyChange,
  onGenerateMediation,
  onChooseAmiable,
}: {
  urgencyMonths: number | null;
  mediationLink?: string;
  resolution?: ResolutionComparison;
  onUrgencyChange: (value: number | null) => void;
  onGenerateMediation: () => void;
  onChooseAmiable: () => void;
}) {
  return (
    <StaggerList className="space-y-4">
      <StaggerItem>
        <DossierCard
          title="Affinage du dossier"
          description="Paramètres optionnels pour personnaliser les recommandations."
          icon={SlidersHorizontal}
          defaultExpanded={false}
          summary={[
            urgencyMonths
              ? `Horizon décisionnel : ${urgencyMonths} mois`
              : "Horizon décisionnel non renseigné",
          ]}
        >
          <InputField
            label="Urgence (mois avant décision)"
            type="number"
            value={urgencyMonths ?? ""}
            onChange={(v) => onUrgencyChange(Number(v) || null)}
            optional
          />
        </DossierCard>
      </StaggerItem>

      <StaggerItem>
        <DossierCard
          title="Médiation asynchrone"
          description="Partagez un lien neutre pour aligner les chiffres sans confrontation."
          icon={Handshake}
          complete={Boolean(mediationLink)}
          summary={mediationLink ? ["Lien de médiation généré"] : ["Lien non généré"]}
          defaultExpanded={!mediationLink}
        >
          <MediationLinkPanel onGenerate={onGenerateMediation} link={mediationLink} embedded />
        </DossierCard>
      </StaggerItem>

      {resolution && (
        <StaggerItem>
          <DossierCard
            title="Amiable vs contentieux"
            description="Comparaison des coûts et délais estimés."
            icon={GitCompare}
            collapsible={false}
            complete
          >
            <ResolutionCompare comparison={resolution} onChooseAmiable={onChooseAmiable} embedded />
          </DossierCard>
        </StaggerItem>
      )}
    </StaggerList>
  );
}

export function PartnerMatchSection({
  result,
  optInPartnerMatch,
  phone,
  resolution,
  onOptInChange,
  onGoToPhoneStep,
}: {
  result: SimulationResult;
  optInPartnerMatch: boolean;
  phone: string;
  resolution?: ResolutionComparison;
  onOptInChange: (value: boolean) => void;
  onGoToPhoneStep: () => void;
}) {
  return (
    <StaggerList className="space-y-4">
      <StaggerItem>
        <DossierCard
          title="Confidentialité"
          description="Mise en relation strictement opt-in, sans engagement."
          icon={Handshake}
          collapsible={false}
          complete
        >
          <TrustStrip variant="compact" />
        </DossierCard>
      </StaggerItem>

      <StaggerItem>
        <DossierCard
          title="Complexité du dossier"
          description="Score calculé à partir de votre simulation."
          icon={BarChart3}
          collapsible={false}
          complete
        >
          <ComplexityBadge score={result.complexityScore} />
        </DossierCard>
      </StaggerItem>

      {optInPartnerMatch && !phone.trim() && (
        <StaggerItem>
          <DossierCard
            title="Coordonnée requise"
            description="Un numéro est nécessaire pour la mise en relation."
            icon={AlertTriangle}
            collapsible={false}
          >
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
              Pour être recontacté par un professionnel, un numéro de téléphone est nécessaire.{" "}
              <button type="button" onClick={onGoToPhoneStep} className="font-medium underline">
                Ajouter mon téléphone
              </button>
            </div>
          </DossierCard>
        </StaggerItem>
      )}

      {resolution && (
        <StaggerItem>
          <DossierCard
            title="Amiable vs contentieux"
            description="Comparer les voies de résolution avant de vous engager."
            icon={GitCompare}
            collapsible={false}
            defaultExpanded={false}
            complete
          >
            <ResolutionCompare
              comparison={resolution}
              onChooseAmiable={() => onOptInChange(true)}
              embedded
            />
          </DossierCard>
        </StaggerItem>
      )}

      <StaggerItem>
        <DossierCard
          title="Mise en relation professionnelle"
          description="Notaire, courtier ou agence selon votre profil."
          icon={Handshake}
          complete={optInPartnerMatch}
          summary={[
            optInPartnerMatch
              ? "Opt-in activé — contact sous 48h ouvrées"
              : "Opt-in non activé",
          ]}
        >
          <OptInCard
            checked={optInPartnerMatch}
            onChange={onOptInChange}
            title="Je souhaite être mis en relation avec un professionnel"
            description="Opt-in explicite, sans engagement."
          />
          {optInPartnerMatch && (
            <p className="text-sm font-medium text-brand-700">
              Merci ! Un professionnel pourra vous contacter sous 48h ouvrées.
            </p>
          )}
        </DossierCard>
      </StaggerItem>
    </StaggerList>
  );
}

export function PremiumOfferSection({ onRestart }: { onRestart: () => void }) {
  return (
    <StaggerList className="space-y-4">
      <StaggerItem>
        <DossierCard
          title="Rapport premium"
          description="Export complet, scénarios illimités et mode médiation."
          icon={FileBadge}
          collapsible={false}
          complete
        >
          <ul className="space-y-3 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <span className="text-brand-600">✓</span>
              PDF détaillé avec tous les scénarios
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-600">✓</span>
              Historique et modifications illimitées
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-600">✓</span>
              Lien partageable pour médiation
            </li>
            <li className="flex items-start gap-2">
              <span className="text-brand-600">✓</span>
              Export comptable
            </li>
          </ul>
          <div className="rounded-xl border border-brand-200/60 bg-brand-50/40 px-5 py-4">
            <p className="text-sm text-slate-600">Tarif unique</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-brand-800">29 €</p>
          </div>
        </DossierCard>
      </StaggerItem>

      <StaggerItem>
        <button
          type="button"
          onClick={onRestart}
          className={cn("text-sm text-slate-500 transition-colors hover:text-brand-600", clarte.btnGhost)}
        >
          Recommencer une simulation
        </button>
      </StaggerItem>
    </StaggerList>
  );
}
