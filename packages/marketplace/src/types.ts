export type PartnerType = "notaire" | "courtier" | "agence";

export type LeadTier = "cold" | "warm" | "hot";

export type PropertyValueRange = "none" | "150k-300k" | "300k-500k" | "500k+";

export interface LeadPreview {
  dept: string;
  postal_code_prefix: string;
  complexity_score: number;
  tier: LeadTier;
  has_real_estate: boolean;
  property_value_range: PropertyValueRange;
  scenario: string;
  status_relationship: string;
  marriage_regime?: string;
  has_minor_children: boolean;
  urgency_months: number | null;
  recommended_for: PartnerType[];
  has_phone: boolean;
  credit_price: number;
  created_at: string;
  expires_in_days: number;
}

export interface LeadContact {
  email: string;
  phone: string | null;
  proof_id: string | null;
  pdf_url: string | null;
  share_token: string | null;
  simulation_summary: Record<string, unknown>;
}

export interface CreateMarketplaceLeadInput {
  brandId?: string;
  simulationId?: string;
  preview: LeadPreview;
  contact: LeadContact;
  creditPrice: number;
  expiresAt?: string;
}

export interface CreditPack {
  id: string;
  credits: number;
  priceCents: number;
  label: string;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack_5", credits: 5, priceCents: 49000, label: "Pack 5 crédits" },
  { id: "pack_15", credits: 15, priceCents: 129000, label: "Pack 15 crédits" },
  { id: "pack_40", credits: 40, priceCents: 299000, label: "Pack 40 crédits" },
];

export function getCreditPack(packId: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === packId);
}
