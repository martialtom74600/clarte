"use client";

import { StaggerList, StaggerItem } from "@/components/ui";
import { LeadCard } from "./lead-card";
import type { LeadPreview } from "@separation/marketplace";

interface LeadWallProps {
  leads: Array<{
    id: string;
    preview: LeadPreview;
    credit_price: number;
  }>;
}

export function LeadWall({ leads }: LeadWallProps) {
  return (
    <StaggerList className="grid gap-4 md:grid-cols-2">
      {leads.map((lead) => (
        <StaggerItem key={lead.id}>
          <LeadCard
            leadId={lead.id}
            preview={lead.preview}
            creditPrice={lead.credit_price}
          />
        </StaggerItem>
      ))}
    </StaggerList>
  );
}
