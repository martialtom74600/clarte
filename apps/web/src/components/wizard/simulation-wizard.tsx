"use client";

import { useEffect, useMemo, useState } from "react";
import { useWizardStore } from "@/store/wizard-store";
import { PropertyDossierSection, ProfilesPatrimonySection } from "./dossier-cards";
import { DossierLivePanel, DossierMobileProgress } from "./dossier-live-panel";
import {
  LegalStatusSection,
  RevelationSection,
  SecureActHubSection,
} from "./wizard-step-sections";
import { StepShell, WizardStepContainer } from "./wizard-ui";
import { SeparationTimeline, WIZARD_MAX_STEP } from "./separation-timeline";
import { clarte, clarteWizardShell } from "@/lib/clarte-design";
import { computeDossierProgress, isWizardActComplete, resolveWizardStep } from "@/lib/dossier-progress";
import { toast } from "sonner";
import { EmotionalSandboxBanner } from "./pain-point-panels";
import { trackEvent } from "@/lib/analytics";
import { computePainPointInsights, generateDocumentProofId } from "@/lib/pain-insights";
import { Eye, EyeOff } from "lucide-react";

export function SimulationWizard() {
  const store = useWizardStore();
  const [emailSent, setEmailSent] = useState(false);

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

  const dossier = useMemo(() => computeDossierProgress(store), [store]);

  const insights = useMemo(
    () => computePainPointInsights(store, lastResult),
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const hasResult = Boolean(lastResult);
    const resolutionInput = {
      step,
      status,
      propertyValue,
      postalCode,
      incomeAMonthly,
      incomeBMonthly,
      hasMinorChildren,
      numberOfChildren,
      custodyType,
    };

    if (dossier.readyForRevelation && !hasResult && step >= 3) {
      computeResult();
      return;
    }

    const resolved = resolveWizardStep(resolutionInput, hasResult);
    if (resolved !== step) {
      setStep(resolved);
    }
  }, [
    step,
    lastResult,
    dossier.readyForRevelation,
    status,
    propertyValue,
    postalCode,
    incomeAMonthly,
    incomeBMonthly,
    hasMinorChildren,
    numberOfChildren,
    custodyType,
    setStep,
    computeResult,
  ]);

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

  const handlePartiesComplete = () => {
    const result = computeResult();
    if (!result) return;
    update({ wowSeen: true });
    trackEvent("wow_moment_shown", { propertyValue, fullDossier: true });
    nextStep();
  };

  const handleSendReport = async () => {
    if (!email.includes("@")) return;
    const input = store.getInput();
    const result = store.lastResult ?? store.computeResult();
    if (!input || !result) return;

    const proofId = documentProofId ?? generateDocumentProofId();
    update({ documentProofId: proofId });
    trackEvent("email_captured", { step });

    const res = await fetch("/api/leads", {
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
    });
    const data = await res.json();
    if (data.shareToken) update({ shareToken: data.shareToken });
    if (res.ok) {
      setEmailSent(true);
      toast.success("Rapport en route", {
        description: "Consultez votre boîte mail dans quelques instants.",
      });
    }
  };

  const handlePublishPartner = async () => {
    if (!optInPartnerMatch || !phone.trim() || !email.includes("@")) return;
    const input = store.getInput();
    const result = store.lastResult;
    if (!input || !result) return;

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
  };

  const handlePremiumCheckout = async () => {
    const input = store.getInput();
    const result = store.lastResult;
    if (!input || !result || !email.includes("@")) return;

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

  const revealed = Boolean(lastResult);
  const safeStep = Math.min(step, WIZARD_MAX_STEP);

  const isActComplete = (actId: number) =>
    isWizardActComplete(actId, store, Boolean(lastResult));

  return (
    <div className={`${clarte.mesh} min-h-screen py-6 md:py-10`}>
      <div className="mx-auto max-w-5xl px-4">
        <div className={clarteWizardShell}>
          <EmotionalSandboxBanner discreteMode={discreteMode} />
          <div className="mb-6 flex items-center justify-between">
            <div className="flex-1">
              <SeparationTimeline currentStep={safeStep} isActComplete={isActComplete} />
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

          <DossierMobileProgress percent={dossier.percent} revealed={revealed} />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
            <WizardStepContainer step={safeStep}>
              {safeStep === 0 && (
                <StepShell
                  title="Votre situation juridique"
                  subtitle="Identifiez le cadre applicable — première section de votre dossier."
                  onNext={nextStep}
                  nextDisabled={!status}
                  showPrev={false}
                >
                  <LegalStatusSection
                    status={status}
                    marriageRegime={marriageRegime}
                    marriageDate={marriageDate}
                    pacsDate={pacsDate}
                    onStatusChange={(v) => update({ status: v })}
                    onMarriageRegimeChange={(v) => update({ marriageRegime: v })}
                    onMarriageDateChange={(v) => update({ marriageDate: v })}
                    onPacsDateChange={(v) => update({ pacsDate: v })}
                  />
                </StepShell>
              )}

              {safeStep === 1 && (
                <StepShell
                  title="Le logement commun"
                  subtitle="Documentez le bien — l'estimation DVF ancre votre dossier sur le marché."
                  onNext={nextStep}
                  onPrev={prevStep}
                  nextDisabled={propertyValue <= 0 || postalCode.length < 5}
                >
                  <PropertyDossierSection
                    postalCode={postalCode}
                    propertyAddress={propertyAddress}
                    propertyValue={propertyValue}
                    mortgageRemaining={mortgageRemaining}
                    shareA={shareA}
                    showShare={status !== "marriage" || marriageRegime !== "communaute_legale"}
                    onPostalCodeChange={(v) => update({ postalCode: v })}
                    onPropertyAddressChange={(v) => update({ propertyAddress: v })}
                    onPropertyValueChange={(v) => update({ propertyValue: v })}
                    onMortgageRemainingChange={(v) => update({ mortgageRemaining: v })}
                    onShareAChange={(a) => update({ shareA: a, shareB: 100 - a })}
                    onDvfLookup={handleDvfLookup}
                  />
                </StepShell>
              )}

              {safeStep === 2 && (
                <StepShell
                  title="Les deux parties"
                  subtitle="Vous, l'autre partie et le foyer — dernières sections avant la révélation."
                  onNext={handlePartiesComplete}
                  onPrev={prevStep}
                  nextDisabled={!dossier.readyForRevelation}
                  nextLabel="Révéler ma projection"
                >
                  <ProfilesPatrimonySection
                    incomeAMonthly={incomeAMonthly}
                    incomeBMonthly={incomeBMonthly}
                    monthlyMortgagePayment={monthlyMortgagePayment}
                    hasMinorChildren={hasMinorChildren}
                    numberOfChildren={numberOfChildren}
                    custodyType={custodyType}
                    savingsJoint={savingsJoint}
                    savingsA={savingsA}
                    savingsB={savingsB}
                    personalDebtsA={personalDebtsA}
                    personalDebtsB={personalDebtsB}
                    onIncomeAChange={(v) => update({ incomeAMonthly: v })}
                    onIncomeBChange={(v) => update({ incomeBMonthly: v })}
                    onMonthlyMortgageChange={(v) => update({ monthlyMortgagePayment: v })}
                    onHasMinorChildrenChange={(checked) =>
                      update({
                        hasMinorChildren: checked,
                        numberOfChildren: checked ? Math.max(numberOfChildren, 1) : 0,
                      })
                    }
                    onNumberOfChildrenChange={(v) => update({ numberOfChildren: v })}
                    onCustodyTypeChange={(v) => update({ custodyType: v })}
                    onSavingsJointChange={(v) => update({ savingsJoint: v })}
                    onSavingsAChange={(v) => update({ savingsA: v })}
                    onSavingsBChange={(v) => update({ savingsB: v })}
                    onPersonalDebtsAChange={(v) => update({ personalDebtsA: v })}
                    onPersonalDebtsBChange={(v) => update({ personalDebtsB: v })}
                  />
                </StepShell>
              )}

              {safeStep === 3 && lastResult && (
                <StepShell
                  title="Révélation"
                  subtitle="Projection complète calculée sur l'ensemble de votre dossier — simulation indicative."
                  onNext={nextStep}
                  onPrev={prevStep}
                  nextLabel="Sécuriser mon dossier"
                >
                  <RevelationSection
                    result={lastResult}
                    imbalance={insights.imbalance ?? undefined}
                    childSupport={insights.childSupport ?? undefined}
                    cashflow={insights.cashflow ?? undefined}
                    selectedScenario={selectedScenario}
                    onSelectScenario={(scenario) => update({ selectedScenario: scenario })}
                  />
                </StepShell>
              )}

              {safeStep === 3 && !lastResult && (
                <StepShell
                  title="Révélation"
                  subtitle="Votre dossier doit être complet avant la projection."
                  onPrev={() => setStep(2)}
                  showPrev
                >
                  <p className="text-sm text-slate-600">
                    Retournez à l&apos;étape précédente pour finaliser vos informations.
                  </p>
                </StepShell>
              )}

              {safeStep === 4 && lastResult && (
                <StepShell
                  title="Sécuriser & agir"
                  subtitle="Choisissez librement la suite — chaque option est indépendante."
                  onPrev={prevStep}
                  showPrev
                >
                  <SecureActHubSection
                    result={lastResult}
                    email={email}
                    phone={phone}
                    emailSent={emailSent}
                    urgencyMonths={urgencyMonths}
                    mediationLink={mediationLink ?? undefined}
                    optInPartnerMatch={optInPartnerMatch}
                    resolution={insights.resolution ?? undefined}
                    onEmailChange={(v) => update({ email: v })}
                    onPhoneChange={(v) => update({ phone: v })}
                    onSendReport={handleSendReport}
                    onUrgencyChange={(v) => update({ urgencyMonths: v })}
                    onGenerateMediation={handleGenerateMediation}
                    onOptInChange={(v) => update({ optInPartnerMatch: v })}
                    onPublishPartner={handlePublishPartner}
                    onPremiumCheckout={handlePremiumCheckout}
                    onRestart={() => {
                      setEmailSent(false);
                      setStep(0);
                    }}
                  />
                </StepShell>
              )}
              {safeStep === 4 && !lastResult && (
                <StepShell
                  title="Sécuriser & agir"
                  subtitle="Calcul de votre projection en cours…"
                  onPrev={() => setStep(2)}
                  showPrev
                >
                  <p className="text-sm text-slate-600">
                    Finalisez vos revenus à l&apos;étape précédente si cette page reste vide.
                  </p>
                </StepShell>
              )}
            </WizardStepContainer>

            <DossierLivePanel
              percent={dossier.percent}
              lines={dossier.lines}
              currentStep={safeStep}
              revealed={revealed}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
