"use client";

import { useEffect } from "react";
import { useWizardStore } from "@/store/wizard-store";
import { SimulationWizard } from "@/components/wizard/simulation-wizard";

export function EmbedWizard({ tenantId }: { tenantId: string }) {
  const update = useWizardStore((s) => s.update);

  useEffect(() => {
    update({ tenantId });
  }, [tenantId, update]);

  return <SimulationWizard />;
}
