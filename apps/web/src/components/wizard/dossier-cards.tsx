"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ChevronDown,
  CircleCheck,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { InputField, SelectCard } from "./wizard-ui";
import { StaggerList, StaggerItem } from "@/components/ui";
import { clarteFocusRing, clarteGlassCard } from "@/lib/clarte-design";
import { cn, formatEuro } from "@/lib/utils";
import { duration, ease, spring } from "@/lib/motion";

interface DossierCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  complete?: boolean;
  defaultExpanded?: boolean;
  collapsible?: boolean;
  summary?: string[];
  children: React.ReactNode;
  className?: string;
}

export function DossierCard({
  title,
  description,
  icon: Icon,
  complete = false,
  defaultExpanded = true,
  collapsible = true,
  summary = [],
  children,
  className,
}: DossierCardProps) {
  const reduced = useReducedMotion();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isOpen = collapsible ? expanded : true;

  const header = (
    <>
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
          complete ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-600"
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold tracking-tight text-slate-900">{title}</p>
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          </div>
          {complete && (
            <motion.div
              initial={reduced ? false : { scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={spring.snappy}
              className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-emerald-700"
            >
              <CircleCheck className="h-4 w-4" strokeWidth={2} />
              <span className="hidden sm:inline">Complet</span>
            </motion.div>
          )}
        </div>

        {collapsible && !isOpen && summary.length > 0 && (
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 space-y-1 border-t border-slate-100 pt-3"
          >
            {summary.map((line) => (
              <li key={line} className="text-sm text-slate-600">
                {line}
              </li>
            ))}
          </motion.ul>
        )}
      </div>

      {collapsible && (
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: duration.fast, ease: ease.out }}
          className="mt-1 shrink-0 text-slate-400"
        >
          <ChevronDown className="h-5 w-5" />
        </motion.div>
      )}
    </>
  );

  return (
    <motion.div
      layout
      className={cn(
        clarteGlassCard,
        "overflow-hidden border transition-colors duration-300",
        complete
          ? "border-brand-200/80 shadow-[0_0_0_1px_rgba(0,111,199,0.08)]"
          : "border-slate-200/80",
        className
      )}
    >
      {collapsible ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-start gap-4 p-5 text-left md:p-6"
          aria-expanded={isOpen}
        >
          {header}
        </button>
      ) : (
        <div className="flex items-start gap-4 p-5 md:p-6">{header}</div>
      )}

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={collapsible && !reduced ? { height: 0, opacity: 0 } : { opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={collapsible && !reduced ? { height: 0, opacity: 0 } : { opacity: 0 }}
            transition={{ duration: duration.normal, ease: ease.out }}
            className="overflow-hidden"
          >
            <div
              className={cn(
                "space-y-5 px-5 pb-5 md:px-6 md:pb-6",
                collapsible && "border-t border-slate-100/80 pt-4"
              )}
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export interface PropertyDossierSectionProps {
  postalCode: string;
  propertyAddress: string;
  propertyValue: number;
  mortgageRemaining: number;
  shareA: number;
  showShare: boolean;
  onPostalCodeChange: (value: string) => void;
  onPropertyAddressChange: (value: string) => void;
  onPropertyValueChange: (value: number) => void;
  onMortgageRemainingChange: (value: number) => void;
  onShareAChange: (value: number) => void;
  onDvfLookup: () => void;
}

export function PropertyDossierSection({
  postalCode,
  propertyAddress,
  propertyValue,
  mortgageRemaining,
  shareA,
  showShare,
  onPostalCodeChange,
  onPropertyAddressChange,
  onPropertyValueChange,
  onMortgageRemainingChange,
  onShareAChange,
  onDvfLookup,
}: PropertyDossierSectionProps) {
  const complete = propertyValue > 0 && postalCode.length >= 5;
  const equity = Math.max(0, propertyValue - mortgageRemaining);

  const summary = [
    postalCode ? `Code postal ${postalCode}` : "Code postal à renseigner",
    propertyValue > 0 ? `Valeur ${formatEuro(propertyValue)}` : "Valeur à estimer",
    mortgageRemaining > 0
      ? `Capital restant dû ${formatEuro(mortgageRemaining)}`
      : "Capital restant dû non renseigné",
    equity > 0 ? `Equity nette ~${formatEuro(equity)}` : undefined,
  ].filter(Boolean) as string[];

  return (
    <StaggerList className="space-y-4">
      <StaggerItem>
        <DossierCard
          title="Logement commun"
          description="Localisation, valorisation et structure de détention du bien."
          icon={Building2}
          complete={complete}
          summary={summary}
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <InputField
                label="Code postal"
                value={postalCode}
                onChange={onPostalCodeChange}
                placeholder="75011"
              />
            </div>
            <button
              type="button"
              onClick={onDvfLookup}
              disabled={postalCode.length < 5}
              className={cn(
                "self-end rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-40",
                clarteFocusRing
              )}
            >
              Estimation DVF
            </button>
          </div>
          <InputField
            label="Adresse ou description"
            value={propertyAddress}
            onChange={onPropertyAddressChange}
            placeholder="Appartement 3 pièces, Paris 11e"
          />
          <div className="grid gap-5 md:grid-cols-2">
            <InputField
              label="Valeur estimée du bien"
              type="number"
              value={propertyValue || ""}
              onChange={(v) => onPropertyValueChange(Number(v) || 0)}
              placeholder="400000"
            />
            <InputField
              label="Capital restant dû crédit immo"
              type="number"
              value={mortgageRemaining || ""}
              onChange={(v) => onMortgageRemainingChange(Number(v) || 0)}
              placeholder="200000"
              optional
            />
          </div>
          {showShare && (
            <InputField
              label="Quote-part — Vous"
              type="number"
              value={shareA}
              onChange={(v) => {
                const a = Math.min(100, Math.max(0, Number(v) || 0));
                onShareAChange(a);
              }}
              hint="Répartition en indivision — par défaut 50 / 50."
            />
          )}
          {propertyValue > 0 && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"
            >
              Equity nette estimée :{" "}
              <span className="font-semibold text-slate-900">{formatEuro(equity)}</span>
            </motion.p>
          )}
        </DossierCard>
      </StaggerItem>
    </StaggerList>
  );
}

export interface ProfilesPatrimonySectionProps {
  incomeAMonthly: number;
  incomeBMonthly: number;
  monthlyMortgagePayment: number;
  hasMinorChildren: boolean;
  numberOfChildren: number;
  custodyType: "classic" | "alternate";
  savingsJoint: number;
  savingsA: number;
  savingsB: number;
  personalDebtsA: number;
  personalDebtsB: number;
  onIncomeAChange: (value: number) => void;
  onIncomeBChange: (value: number) => void;
  onMonthlyMortgageChange: (value: number) => void;
  onHasMinorChildrenChange: (value: boolean) => void;
  onNumberOfChildrenChange: (value: number) => void;
  onCustodyTypeChange: (value: "classic" | "alternate") => void;
  onSavingsJointChange: (value: number) => void;
  onSavingsAChange: (value: number) => void;
  onSavingsBChange: (value: number) => void;
  onPersonalDebtsAChange: (value: number) => void;
  onPersonalDebtsBChange: (value: number) => void;
}

export function ProfilesPatrimonySection({
  incomeAMonthly,
  incomeBMonthly,
  monthlyMortgagePayment,
  hasMinorChildren,
  numberOfChildren,
  custodyType,
  savingsJoint,
  savingsA,
  savingsB,
  personalDebtsA,
  personalDebtsB,
  onIncomeAChange,
  onIncomeBChange,
  onMonthlyMortgageChange,
  onHasMinorChildrenChange,
  onNumberOfChildrenChange,
  onCustodyTypeChange,
  onSavingsJointChange,
  onSavingsAChange,
  onSavingsBChange,
  onPersonalDebtsAChange,
  onPersonalDebtsBChange,
}: ProfilesPatrimonySectionProps) {
  const profileAComplete = incomeAMonthly > 0;
  const profileBComplete = incomeBMonthly > 0;
  const householdComplete =
    !hasMinorChildren || (numberOfChildren >= 1 && Boolean(custodyType));

  return (
    <StaggerList className="space-y-4">
      <StaggerItem>
        <DossierCard
          title="Vous"
          description="Vos revenus et passif personnel."
          icon={User}
          complete={profileAComplete}
          summary={[
            incomeAMonthly > 0
              ? `Revenu net ${formatEuro(incomeAMonthly)}/mois`
              : "Revenu mensuel à renseigner",
            savingsA > 0 ? `Épargne ${formatEuro(savingsA)}` : "Épargne personnelle non renseignée",
            personalDebtsA > 0
              ? `Dettes ${formatEuro(personalDebtsA)}`
              : "Dettes personnelles non renseignées",
          ]}
        >
          <InputField
            label="Revenu mensuel net"
            type="number"
            value={incomeAMonthly || ""}
            onChange={(v) => onIncomeAChange(Number(v) || 0)}
            placeholder="3200"
          />
          <div className="grid gap-5 md:grid-cols-2">
            <InputField
              label="Épargne personnelle"
              type="number"
              value={savingsA || ""}
              onChange={(v) => onSavingsAChange(Number(v) || 0)}
              optional
            />
            <InputField
              label="Dettes personnelles"
              type="number"
              value={personalDebtsA || ""}
              onChange={(v) => onPersonalDebtsAChange(Number(v) || 0)}
              optional
            />
          </div>
        </DossierCard>
      </StaggerItem>

      <StaggerItem>
        <DossierCard
          title="Autre partie"
          description="Revenus et passif personnel de l'autre partie."
          icon={User}
          complete={profileBComplete}
          summary={[
            incomeBMonthly > 0
              ? `Revenu net ${formatEuro(incomeBMonthly)}/mois`
              : "Revenu mensuel à renseigner",
            savingsB > 0 ? `Épargne ${formatEuro(savingsB)}` : "Épargne personnelle non renseignée",
            personalDebtsB > 0
              ? `Dettes ${formatEuro(personalDebtsB)}`
              : "Dettes personnelles non renseignées",
          ]}
        >
          <InputField
            label="Revenu mensuel net"
            type="number"
            value={incomeBMonthly || ""}
            onChange={(v) => onIncomeBChange(Number(v) || 0)}
            placeholder="2800"
          />
          <div className="grid gap-5 md:grid-cols-2">
            <InputField
              label="Épargne personnelle"
              type="number"
              value={savingsB || ""}
              onChange={(v) => onSavingsBChange(Number(v) || 0)}
              optional
            />
            <InputField
              label="Dettes personnelles"
              type="number"
              value={personalDebtsB || ""}
              onChange={(v) => onPersonalDebtsBChange(Number(v) || 0)}
              optional
            />
          </div>
        </DossierCard>
      </StaggerItem>

      <StaggerItem>
        <DossierCard
          title="Foyer & charges"
          description="Charges récurrentes et situation des enfants mineurs."
          icon={Users}
          complete={householdComplete}
          summary={[
            monthlyMortgagePayment > 0
              ? `Mensualité crédit ${formatEuro(monthlyMortgagePayment)}/mois`
              : "Mensualité crédit non renseignée",
            hasMinorChildren
              ? `${numberOfChildren} enfant${numberOfChildren > 1 ? "s" : ""} — garde ${
                  custodyType === "alternate" ? "alternée" : "classique"
                }`
              : "Pas d'enfant mineur concerné",
          ]}
        >
          <InputField
            label="Mensualité crédit immo actuelle"
            type="number"
            value={monthlyMortgagePayment || ""}
            onChange={(v) => onMonthlyMortgageChange(Number(v) || 0)}
            optional
          />
          <label className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white/60 px-4 py-3">
            <input
              type="checkbox"
              checked={hasMinorChildren}
              onChange={(e) => onHasMinorChildrenChange(e.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-700">Enfants mineurs concernés</span>
          </label>
          {hasMinorChildren && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-5 overflow-hidden"
            >
              <InputField
                label="Nombre d'enfants"
                type="number"
                value={numberOfChildren || 1}
                onChange={(v) => onNumberOfChildrenChange(Math.max(1, Number(v) || 1))}
              />
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">Type de garde</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <SelectCard
                    label="Garde classique"
                    description="Un parent principal, droit de visite"
                    selected={custodyType === "classic"}
                    onClick={() => onCustodyTypeChange("classic")}
                  />
                  <SelectCard
                    label="Garde alternée"
                    description="Résidence partagée entre les deux parents"
                    selected={custodyType === "alternate"}
                    onClick={() => onCustodyTypeChange("alternate")}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </DossierCard>
      </StaggerItem>

      <StaggerItem>
        <DossierCard
          title="Patrimoine commun"
          description="Actifs partagés en dehors du logement principal."
          icon={Wallet}
          complete={savingsJoint > 0}
          defaultExpanded={false}
          summary={[
            savingsJoint > 0
              ? `Épargne commune ${formatEuro(savingsJoint)}`
              : "Épargne commune non renseignée (optionnel)",
          ]}
        >
          <InputField
            label="Épargne commune"
            type="number"
            value={savingsJoint || ""}
            onChange={(v) => onSavingsJointChange(Number(v) || 0)}
            optional
            hint="Comptes joints, livrets ou placements détenus à deux."
          />
        </DossierCard>
      </StaggerItem>
    </StaggerList>
  );
}
