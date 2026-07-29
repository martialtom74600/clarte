"use client";

import { useEffect } from "react";
import { useWizardStore } from "@/store/wizard-store";
import { SimulationWizard } from "@/components/wizard/simulation-wizard";

export function EmbedWizard({ tenantId }: { tenantId: string }) {
  const update = useWizardStore((s) => s.update);

  useEffect(() => {
    update({ tenantId });
    document.querySelector("header")?.setAttribute("style", "display:none");
    document.querySelector("footer")?.setAttribute("style", "display:none");
    return () => {
      document.querySelector("header")?.removeAttribute("style");
      document.querySelector("footer")?.removeAttribute("style");
    };
  }, [tenantId, update]);

  return <SimulationWizard />;
}
