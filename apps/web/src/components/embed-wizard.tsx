"use client";

import { useEffect } from "react";
import { useSeparationStore } from "@/store/separation-store";
import { EmpreinteShell } from "@/components/separation/empreinte/empreinte-shell";

export function EmbedWizard({ tenantId }: { tenantId: string }) {
  useEffect(() => {
    useSeparationStore.setState({ discreteMode: true });
  }, [tenantId]);

  return <EmpreinteShell />;
}
