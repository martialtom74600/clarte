import type { LeadScore } from "@separation/schemas";
import type { LeadContact, LeadPreview, PartnerType, PropertyValueRange } from "./types.js";

interface BuildPreviewInput {
  postalCode: string;
  complexityScore: number;
  tier: LeadScore["tier"];
  hasRealEstate: boolean;
  propertyValue: number;
  scenario: string;
  statusRelationship: string;
  marriageRegime?: string;
  hasMinorChildren: boolean;
  urgencyMonths?: number | null;
  recommendedFor: PartnerType[];
  hasPhone: boolean;
  creditPrice: number;
  createdAt?: string;
  expiresInDays?: number;
}

export function maskPostalCode(postalCode: string): string {
  const clean = postalCode.replace(/\s/g, "");
  if (clean.length < 3) return "***";
  return `${clean.slice(0, 3)}**`;
}

export function getDept(postalCode: string): string {
  const clean = postalCode.replace(/\s/g, "");
  if (clean.startsWith("97") || clean.startsWith("98")) return clean.slice(0, 3);
  return clean.slice(0, 2);
}

export function getPropertyValueRange(value: number): PropertyValueRange {
  if (value <= 0) return "none";
  if (value < 300000) return "150k-300k";
  if (value < 500000) return "300k-500k";
  return "500k+";
}

export function buildLeadPreview(input: BuildPreviewInput): LeadPreview {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const expiresInDays = input.expiresInDays ?? 30;

  return {
    dept: getDept(input.postalCode),
    postal_code_prefix: maskPostalCode(input.postalCode),
    complexity_score: input.complexityScore,
    tier: input.tier,
    has_real_estate: input.hasRealEstate,
    property_value_range: getPropertyValueRange(input.propertyValue),
    scenario: input.scenario,
    status_relationship: input.statusRelationship,
    marriage_regime: input.marriageRegime,
    has_minor_children: input.hasMinorChildren,
    urgency_months: input.urgencyMonths ?? null,
    recommended_for: input.recommendedFor,
    has_phone: input.hasPhone,
    credit_price: input.creditPrice,
    created_at: createdAt,
    expires_in_days: expiresInDays,
  };
}

export function buildLeadContact(input: {
  email: string;
  phone?: string | null;
  proofId?: string | null;
  pdfUrl?: string | null;
  shareToken?: string | null;
  simulationSummary: Record<string, unknown>;
}): LeadContact {
  return {
    email: input.email,
    phone: input.phone?.trim() || null,
    proof_id: input.proofId ?? null,
    pdf_url: input.pdfUrl ?? null,
    share_token: input.shareToken ?? null,
    simulation_summary: input.simulationSummary,
  };
}

export function isLeadSellable(contact: LeadContact): boolean {
  return Boolean(contact.email && contact.phone);
}

export function scenarioLabel(scenario: string): string {
  const labels: Record<string, string> = {
    keep_a: "Rachat par A",
    keep_b: "Rachat par B",
    sell: "Vente",
    compare_all: "Comparaison",
  };
  return labels[scenario] ?? scenario;
}

export function tierLabel(tier: LeadPreview["tier"]): string {
  return { cold: "Froid", warm: "Tiède", hot: "Chaud" }[tier];
}
