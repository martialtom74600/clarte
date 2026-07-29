"use client";

import { useEffect, useMemo } from "react";
import { useWizardStore } from "@/store/wizard-store";
import { StepShell, SelectCard, InputField, WizardStepContainer } from "./wizard-ui";
import { SeparationTimeline } from "./separation-timeline";
import { TrustStrip, OptInCard, FloatingInput } from "@/components/ui";
import { clarte, clarteWizardShell } from "@/lib/clarte-design";
import { toast } from "sonner";
import {
  CashflowPanel,
  ChildSupportPanel,
  ImbalanceAlert,
  ResolutionCompare,
  MediationLinkPanel,
  EmotionalSandboxBanner,
} from "./pain-point-panels";
import {
  WowMoment,
  DoubleMirror,
  PatrimonyChart,
  ScenarioCards,
} from "@/components/simulation-charts";
import { trackEvent } from "@/lib/analytics";
import { computePainPointInsights, generateDocumentProofId } from "@/lib/pain-insights";
import { ComplexityBadge } from "@separation/ui";
import type { SimulationInput } from "@separation/schemas";
import { Eye, EyeOff } from "lucide-react";

export function SimulationWizard() {
  const store = useWizardStore();
  const {
    step,
    status,
    marriageRegime,
    marriageDate,
    pacsDate,
    postalCode,
    propertyAddress,
    propertyValue,
    mortgageRemaining,
    shareA,
    savingsJoint,
    savingsA,
    savingsB,
    personalDebtsA,
    personalDebtsB,
    selectedScenario,
    hasMinorChildren,
    numberOfChildren,
    custodyType,
    incomeAMonthly,
    incomeBMonthly,
    monthlyMortgagePayment,
    mediationLink,
    documentProofId,
    shareToken,
    urgencyMonths,
    email,
    phone,
    optInPartnerMatch,
    discreteMode,
    lastResult,
    update,
    setStep,
    nextStep,
    prevStep,
    computeResult,
  } = store;

  const insights = useMemo(
    () => computePainPointInsights(store, lastResult),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- store fields are listed explicitly
    [
      lastResult,
      numberOfChildren,
      custodyType,
      incomeAMonthly,
      incomeBMonthly,
      monthlyMortgagePayment,
      selectedScenario,
      propertyValue,
      postalCode,
      store.status,
    ]
  );

  useEffect(() => {
    if (discreteMode) {
      document.title = "Calculatrice";
    } else {
      document.title = "Simulation patrimoniale — Clarté";
    }
  }, [discreteMode]);

  useEffect(() => {
    trackEvent("wizard_step_viewed", { step });
  }, [step]);

  const handlePropertyNext = () => {
    computeResult();
    update({ wowSeen: true });
    trackEvent("wow_moment_shown", { propertyValue });
    nextStep();
  };

  const handleEmailSubmit = async () => {
    if (!email) return;
    const input = store.getInput();
    const result = store.lastResult ?? store.computeResult();
    if (!input || !result) return;

    const proofId = documentProofId ?? generateDocumentProofId();
    update({ documentProofId: proofId });

    trackEvent("email_captured", { step });

    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        phone: phone.trim() || undefined,
        simulation: input,
        result,
        proofId,
        postalCode,
        urgencyMonths,
        hasMinorChildren,
        scenarioPreference: store.selectedScenario,
      }),
    }).then(async (res) => {
      const data = await res.json();
      if (data.shareToken) update({ shareToken: data.shareToken });
      if (res.ok) {
        toast.success("Rapport en route", {
          description: "Consultez votre boîte mail dans quelques instants.",
        });
      }
    });

    nextStep();
  };

  const handlePartnerStepNext = async () => {
    if (optInPartnerMatch && !phone.trim()) {
      update({ step: 5 });
      return;
    }

    if (optInPartnerMatch && phone.trim()) {
      const input = store.getInput();
      const result = store.lastResult;
      if (input && result) {
        const publishRes = await fetch("/api/leads/marketplace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            phone: phone.trim(),
            postalCode,
            proofId: documentProofId,
            shareToken,
            simulation: input,
            result,
            optInPartnerMatch: true,
            urgencyMonths,
            hasMinorChildren,
          }),
        });
        if (publishRes.ok) {
          const publishData = await publishRes.json();
          if (publishData.listed) {
            trackEvent("marketplace_lead_published");
            toast.success("Mise en relation activée", {
              description: "Un professionnel pourra vous contacter sous 48h ouvrées.",
            });
          }
        }
      }
    }

    setStep(8);
  };

  const handlePremiumCheckout = async () => {
    const input = store.getInput();
    const result = store.lastResult;
    if (!input || !result || !email) return;

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, simulation: input, result }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  const handleDvfLookup = async () => {
    if (!postalCode || postalCode.length < 5) return;
    trackEvent("dvf_lookup_requested", { postalCode });
    const res = await fetch(`/api/dvf?postalCode=${postalCode}`);
    const data = await res.json();
    if (data.estimatedValue) {
      update({ propertyValue: data.estimatedValue });
      trackEvent("dvf_lookup_success", { estimatedValue: data.estimatedValue });
    }
  };

  const handleGenerateMediation = async () => {
    const input = store.getInput();
    if (!input) return;

    const res = await fetch("/api/mediation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partyAData: {
          propertyValue,
          mortgageRemaining,
          incomeAMonthly,
          incomeBMonthly,
          assets: input.assets,
          liabilities: input.liabilities,
        },
        tenantId: store.tenantId,
      }),
    });
    const data = await res.json();
    if (data.link) {
      update({ mediationLink: data.link, mediationToken: data.token });
      trackEvent("mediation_link_created");
    }
  };

  return (
    <div className={`${clarte.mesh} min-h-screen py-6 md:py-10`}>
      <div className={clarte.containerNarrow}>
        <div className={clarteWizardShell}>
          <EmotionalSandboxBanner discreteMode={discreteMode} />
          <div className="mb-6 flex items-center justify-between">
            <div className="flex-1">
              <SeparationTimeline currentStep={step} />
            </div>
            <button
              type="button"
              onClick={() => update({ discreteMode: !discreteMode })}
              className="ml-4 rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100/80"
              title="Mode discret"
            >
              {discreteMode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          <WizardStepContainer step={step}>
      {step === 0 && (
        <StepShell
          title="Quelle est votre situation ?"
          subtitle="Cette information détermine les règles de répartition patrimoniale applicables."
          onNext={nextStep}
          nextDisabled={!status}
          showPrev={false}
        >
          <div className="space-y-3">
            <SelectCard
              label="Concubinage"
              description="Vie commune sans PACS ni mariage. Indivision par défaut."
              selected={status === "concubinage"}
              onClick={() => update({ status: "concubinage" })}
            />
            <SelectCard
              label="PACS"
              description="Séparation de biens de plein droit, sauf convention contraire."
              selected={status === "pacs"}
              onClick={() => update({ status: "pacs" })}
            />
            <SelectCard
              label="Mariage"
              description="Régime matrimonial applicable (communauté légale par défaut)."
              selected={status === "marriage"}
              onClick={() => update({ status: "marriage" })}
            />
          </div>

          {status === "marriage" && (
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Régime matrimonial
              </label>
              <select
                value={marriageRegime}
                onChange={(e) =>
                  update({
                    marriageRegime: e.target.value as SimulationInput["marriageRegime"],
                  })
                }
                className="w-full rounded-xl border border-slate-200 px-4 py-3"
              >
                <option value="communaute_legale">Communauté légale</option>
                <option value="separation_biens">Séparation de biens</option>
                <option value="communaute_universelle">Communauté universelle</option>
              </select>
              <InputField
                label="Date de mariage"
                type="date"
                value={marriageDate}
                onChange={(v) => update({ marriageDate: v })}
                optional
              />
            </div>
          )}

          {status === "pacs" && (
            <div className="mt-6">
              <InputField
                label="Date du PACS"
                type="date"
                value={pacsDate}
                onChange={(v) => update({ pacsDate: v })}
                optional
              />
            </div>
          )}
        </StepShell>
      )}

      {step === 1 && (
        <StepShell
          title="Votre logement commun"
          subtitle="Estimez la valeur et le crédit restant. Nous pré-remplissons via DVF si possible."
          onNext={handlePropertyNext}
          onPrev={prevStep}
          nextDisabled={propertyValue <= 0}
        >
          <div className="space-y-5">
            <div className="flex gap-3">
              <div className="flex-1">
                <InputField
                  label="Code postal"
                  value={postalCode}
                  onChange={(v) => update({ postalCode: v })}
                  placeholder="75011"
                />
              </div>
              <button
                type="button"
                onClick={handleDvfLookup}
                className="self-end rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700 hover:bg-brand-100"
              >
                Estimer via DVF
              </button>
            </div>
            <InputField
              label="Adresse ou description"
              value={propertyAddress}
              onChange={(v) => update({ propertyAddress: v })}
              placeholder="Appartement 3 pièces, Paris 11e"
            />
            <InputField
              label="Valeur estimée du bien (€)"
              type="number"
              value={propertyValue || ""}
              onChange={(v) => update({ propertyValue: Number(v) || 0 })}
              placeholder="400000"
            />
            <InputField
              label="Capital restant dû crédit immo (€)"
              type="number"
              value={mortgageRemaining || ""}
              onChange={(v) => update({ mortgageRemaining: Number(v) || 0 })}
              placeholder="200000"
              optional
            />
            {status !== "marriage" || marriageRegime !== "communaute_legale" ? (
              <InputField
                label="Quote-part personne A (%)"
                type="number"
                value={shareA}
                onChange={(v) => {
                  const a = Math.min(100, Math.max(0, Number(v) || 0));
                  update({ shareA: a, shareB: 100 - a });
                }}
                hint="Par défaut 50/50 en indivision"
              />
            ) : null}
          </div>
        </StepShell>
      )}

      {step === 2 && lastResult && (
        <StepShell
          title="Votre estimation"
          subtitle="Voici une première projection. Ce n'est qu'une simulation — rien n'est engagé."
          onNext={nextStep}
          onPrev={prevStep}
        >
          <WowMoment result={lastResult} />
          <div className="mt-8">
            <DoubleMirror result={lastResult} />
          </div>
          <div className="mt-8">
            <PatrimonyChart result={lastResult} />
          </div>
          {insights.imbalance && (
            <div className="mt-6">
              <ImbalanceAlert imbalance={insights.imbalance} />
            </div>
          )}
          {lastResult.warnings.length > 0 && (
            <div className="mt-6 space-y-2">
              {lastResult.warnings.map((w) => (
                <div
                  key={w.code}
                  className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900"
                >
                  {w.message}
                </div>
              ))}
            </div>
          )}
        </StepShell>
      )}

      {step === 3 && (
        <StepShell
          title="Patrimoine et budget mensuel"
          subtitle="Revenus, enfants et charges — pour anticiper votre niveau de vie après séparation."
          onNext={() => {
            computeResult();
            nextStep();
          }}
          onPrev={prevStep}
        >
          <div className="space-y-5">
            <InputField
              label="Revenu mensuel net personne A (€)"
              type="number"
              value={incomeAMonthly || ""}
              onChange={(v) => update({ incomeAMonthly: Number(v) || 0 })}
            />
            <InputField
              label="Revenu mensuel net personne B (€)"
              type="number"
              value={incomeBMonthly || ""}
              onChange={(v) => update({ incomeBMonthly: Number(v) || 0 })}
            />
            <InputField
              label="Mensualité crédit immo actuelle (€)"
              type="number"
              value={monthlyMortgagePayment || ""}
              onChange={(v) => update({ monthlyMortgagePayment: Number(v) || 0 })}
              optional
            />
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={hasMinorChildren}
                onChange={(e) =>
                  update({
                    hasMinorChildren: e.target.checked,
                    numberOfChildren: e.target.checked ? Math.max(numberOfChildren, 1) : 0,
                  })
                }
                className="h-5 w-5 rounded border-slate-300"
              />
              <span className="text-sm text-slate-700">Enfants mineurs concernés</span>
            </label>
            {hasMinorChildren && (
              <>
                <InputField
                  label="Nombre d'enfants"
                  type="number"
                  value={numberOfChildren || 1}
                  onChange={(v) => update({ numberOfChildren: Math.max(1, Number(v) || 1) })}
                />
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Type de garde</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <SelectCard
                      label="Garde classique"
                      description="Un parent principal, droit de visite"
                      selected={custodyType === "classic"}
                      onClick={() => update({ custodyType: "classic" })}
                    />
                    <SelectCard
                      label="Garde alternée"
                      description="Résidence partagée entre les deux parents"
                      selected={custodyType === "alternate"}
                      onClick={() => update({ custodyType: "alternate" })}
                    />
                  </div>
                </div>
              </>
            )}
            <InputField
              label="Épargne commune (€)"
              type="number"
              value={savingsJoint || ""}
              onChange={(v) => update({ savingsJoint: Number(v) || 0 })}
              optional
            />
            <InputField
              label="Épargne personne A (€)"
              type="number"
              value={savingsA || ""}
              onChange={(v) => update({ savingsA: Number(v) || 0 })}
              optional
            />
            <InputField
              label="Épargne personne B (€)"
              type="number"
              value={savingsB || ""}
              onChange={(v) => update({ savingsB: Number(v) || 0 })}
              optional
            />
            <InputField
              label="Dettes personnelles A (€)"
              type="number"
              value={personalDebtsA || ""}
              onChange={(v) => update({ personalDebtsA: Number(v) || 0 })}
              optional
            />
            <InputField
              label="Dettes personnelles B (€)"
              type="number"
              value={personalDebtsB || ""}
              onChange={(v) => update({ personalDebtsB: Number(v) || 0 })}
              optional
            />
          </div>
          {insights.childSupport && (
            <div className="mt-6">
              <ChildSupportPanel support={insights.childSupport} />
            </div>
          )}
        </StepShell>
      )}

      {step === 4 && lastResult && (
        <StepShell
          title="Comparez vos scénarios"
          subtitle="Que se passe-t-il si l'un rachète, ou si vous vendez ?"
          onNext={nextStep}
          onPrev={prevStep}
        >
          <ScenarioCards
            result={lastResult}
            onSelect={(scenario) =>
              update({
                selectedScenario: scenario as SimulationInput["options"]["scenario"],
              })
            }
          />
          {insights.cashflow && (
            <div className="mt-8">
              <CashflowPanel cashflow={insights.cashflow} />
            </div>
          )}
        </StepShell>
      )}

      {step === 5 && (
        <StepShell
          title="Recevez votre rapport PDF horodaté"
          subtitle="Preuve d'instant T : photographie financière figée, utilisable en médiation."
          onNext={handleEmailSubmit}
          onPrev={prevStep}
          nextLabel="Recevoir mon rapport certifié"
          nextDisabled={!email.includes("@")}
          conversion
        >
          <TrustStrip />
          <div className="mt-6 space-y-5">
            <div className="rounded-xl border border-brand-200/60 bg-brand-50/50 px-4 py-3 text-sm text-brand-800">
              Votre rapport inclura un identifiant unique de preuve (instant T) pour sécuriser vos
              échanges.
            </div>
            <FloatingInput
              label="Votre email"
              type="email"
              value={email}
              onChange={(v) => update({ email: v })}
              validate={(v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)}
              hint="Nous ne partageons jamais votre email sans votre accord."
            />
            <InputField
              label="Téléphone mobile"
              type="tel"
              value={phone}
              onChange={(v) => update({ phone: v })}
              placeholder="06 12 34 56 78"
              optional
              hint="Pour qu'un professionnel puisse vous conseiller si vous le souhaitez — jamais partagé sans votre accord explicite."
            />
          </div>
        </StepShell>
      )}

      {step === 6 && (
        <StepShell
          title="Quelques questions"
          subtitle="Pour affiner nos recommandations (optionnel)."
          onNext={nextStep}
          onPrev={prevStep}
        >
          <div className="space-y-5">
            <InputField
              label="Urgence (mois avant décision)"
              type="number"
              value={urgencyMonths ?? ""}
              onChange={(v) => update({ urgencyMonths: Number(v) || null })}
              optional
            />
          </div>
          <div className="mt-8">
            <MediationLinkPanel onGenerate={handleGenerateMediation} link={mediationLink ?? undefined} />
          </div>
          {insights.resolution && (
            <div className="mt-8">
              <ResolutionCompare
                comparison={insights.resolution}
                onChooseAmiable={() => update({ optInPartnerMatch: true })}
              />
            </div>
          )}
        </StepShell>
      )}

      {step === 7 && lastResult && (
        <StepShell
          title="Trouver un professionnel"
          subtitle="Des experts près de chez vous peuvent valider votre situation."
          onNext={handlePartnerStepNext}
          onPrev={prevStep}
          nextLabel="Continuer"
          nextDisabled={optInPartnerMatch && !phone.trim()}
          conversion
        >
          <TrustStrip variant="compact" />
          <div className="mb-6 mt-6">
            <ComplexityBadge score={lastResult.complexityScore} />
          </div>
          {optInPartnerMatch && !phone.trim() && (
            <div className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
              Pour être recontacté par un professionnel, un numéro de téléphone est nécessaire.{" "}
              <button type="button" onClick={() => setStep(5)} className="font-medium underline">
                Ajouter mon téléphone
              </button>
            </div>
          )}
          {insights.resolution && (
            <div className="mb-6">
              <ResolutionCompare
                comparison={insights.resolution}
                onChooseAmiable={() => update({ optInPartnerMatch: true })}
              />
            </div>
          )}
          <OptInCard
            checked={optInPartnerMatch}
            onChange={(v) => update({ optInPartnerMatch: v })}
            title="Je souhaite être mis en relation avec un professionnel"
            description="Notaire, courtier ou agence selon votre profil. Opt-in explicite, sans engagement."
          />
          {optInPartnerMatch && (
            <p className="mt-4 text-sm font-medium text-brand-700">
              Merci ! Un professionnel pourra vous contacter sous 48h ouvrées.
            </p>
          )}
        </StepShell>
      )}

      {step === 8 && lastResult && (
        <StepShell
          title="Rapport premium"
          subtitle="Export complet, scénarios illimités et mode médiation."
          onNext={handlePremiumCheckout}
          onPrev={prevStep}
          nextLabel="Obtenir le rapport premium — 29 €"
          conversion
        >
          <div className="rounded-2xl border-2 border-brand-300/60 bg-gradient-to-br from-brand-50 to-white p-6 shadow-[0_0_40px_rgba(12,140,233,0.08)]">
            <ul className="space-y-3 text-sm text-slate-700">
              <li>✓ PDF détaillé avec tous les scénarios</li>
              <li>✓ Historique et modifications illimitées</li>
              <li>✓ Lien partageable pour médiation</li>
              <li>✓ Export comptable</li>
            </ul>
            <p className="mt-4 text-2xl font-bold text-brand-800">29 €</p>
          </div>
          <button
            type="button"
            onClick={() => setStep(0)}
            className="mt-6 text-sm text-slate-500 transition-colors hover:text-brand-600"
          >
            Recommencer une simulation
          </button>
        </StepShell>
      )}
          </WizardStepContainer>
        </div>
      </div>
    </div>
  );
}
