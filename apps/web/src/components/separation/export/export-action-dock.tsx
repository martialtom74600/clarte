"use client";

import { useState } from "react";
import { Briefcase, Mail } from "lucide-react";
import type { DoorVerdictMap, SimulationResult } from "@separation/schemas";
import { cn } from "@/lib/utils";
import type {
  AssumptionsState,
  FootprintState,
  LabState,
} from "@/lib/separation/separation-types";
import { ExportMediationPanel } from "./export-mediation-panel";
import { ExportPartnerOptInPanel } from "./export-partner-optin-panel";
import styles from "./export-bilan.module.css";

type ActionId = "expert" | "share";

interface ExportActionDockProps {
  scenarioTitle: string;
  result: SimulationResult;
  footprint: FootprintState;
  assumptions: AssumptionsState;
  lab: LabState;
  doorVerdicts: DoorVerdictMap | null;
}

export function ExportActionDock({
  scenarioTitle,
  result,
  footprint,
  assumptions,
  lab,
  doorVerdicts,
}: ExportActionDockProps) {
  const [open, setOpen] = useState<ActionId | null>("expert");

  const toggle = (id: ActionId) => {
    setOpen((prev) => (prev === id ? null : id));
  };

  return (
    <div className={cn(styles.actionDock, styles.noPrint)}>
      <div className={styles.actionDockBar}>
        <p className={styles.actionDockLabel}>Besoin d&apos;un coup de main ?</p>
        <div className={styles.actionDockChoices}>
          <button
            type="button"
            onClick={() => toggle("expert")}
            aria-expanded={open === "expert"}
            className={cn(
              styles.actionChoice,
              open === "expert" && styles.actionChoiceActive
            )}
          >
            <Briefcase className="h-4 w-4 shrink-0" aria-hidden />
            <span>Parler à un expert</span>
          </button>
          <button
            type="button"
            onClick={() => toggle("share")}
            aria-expanded={open === "share"}
            className={cn(
              styles.actionChoice,
              styles.actionChoiceSecondary,
              open === "share" && styles.actionChoiceActiveSecondary
            )}
          >
            <Mail className="h-4 w-4 shrink-0" aria-hidden />
            <span>Envoyer à l&apos;autre</span>
          </button>
        </div>
      </div>

      {open === "expert" && (
        <div className={styles.actionDockPanel}>
          <ExportPartnerOptInPanel result={result} compact />
        </div>
      )}
      {open === "share" && (
        <div className={styles.actionDockPanel}>
          <ExportMediationPanel
            scenarioTitle={scenarioTitle}
            footprint={footprint}
            assumptions={assumptions}
            lab={lab}
            result={result}
            doorVerdicts={doorVerdicts}
            compact
          />
        </div>
      )}
    </div>
  );
}
