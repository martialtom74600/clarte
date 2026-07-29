import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { CreateMarketplaceLeadInput, LeadContact, LeadPreview } from "@separation/marketplace";

let supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!supabaseAdmin) supabaseAdmin = createClient(url, key);
  return supabaseAdmin;
}

export function getSupabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface StoredLead {
  id?: string;
  email: string;
  tenant_id: string;
  score: number;
  tier: string;
  qualifies_for_cpl: boolean;
  recommended_partners: string[];
  simulation_data: Record<string, unknown>;
  phone?: string | null;
  created_at?: string;
}

export interface StoredSimulation {
  id?: string;
  tenant_id: string;
  input_data: Record<string, unknown>;
  result_data: Record<string, unknown>;
  share_token?: string;
  created_at?: string;
}

export interface PartnerRow {
  id: string;
  type: "notaire" | "courtier" | "agence";
  company_name: string;
  geo_zones: string[];
  credit_balance: number;
  is_active: boolean;
  stripe_customer_id?: string | null;
}

export interface PartnerUserRow {
  id: string;
  partner_id: string;
  role: string;
  full_name: string | null;
}

export interface MarketplaceLeadRow {
  id: string;
  brand_id: string;
  simulation_id: string | null;
  preview: LeadPreview;
  contact?: LeadContact;
  status: string;
  credit_price: number;
  expires_at: string | null;
  created_at: string;
}

export async function saveLead(lead: StoredLead) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { id: crypto.randomUUID(), ...lead };
  }
  const { data, error } = await supabase.from("leads").insert(lead).select().single();
  if (error) throw error;
  return data;
}

export async function saveSimulation(simulation: StoredSimulation) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { id: crypto.randomUUID(), ...simulation };
  }
  const { data, error } = await supabase.from("simulations").insert(simulation).select().single();
  if (error) throw error;
  return data;
}

export async function createMarketplaceLead(input: CreateMarketplaceLeadInput) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { id: crypto.randomUUID(), ...input };
  }
  const { data, error } = await supabase
    .from("marketplace_leads")
    .insert({
      brand_id: input.brandId ?? "default",
      simulation_id: input.simulationId ?? null,
      preview: input.preview,
      contact: input.contact,
      credit_price: input.creditPrice,
      expires_at: input.expiresAt ?? null,
      status: "available",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSimulationByToken(token: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase.from("simulations").select("*").eq("share_token", token).single();
  return data;
}

export async function getPartnerUserByAuthId(authId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data: userRow } = await supabase
    .from("partner_users")
    .select("*")
    .eq("id", authId)
    .single();
  if (!userRow) return null;
  const { data: partner } = await supabase
    .from("partners")
    .select("*")
    .eq("id", userRow.partner_id)
    .single();
  return partner ? { user: userRow as PartnerUserRow, partner: partner as PartnerRow } : null;
}

export async function getAvailableLeadsForPartner(partner: PartnerRow) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data } = await supabase
    .from("marketplace_leads")
    .select("id, brand_id, simulation_id, preview, status, credit_price, expires_at, created_at")
    .eq("status", "available")
    .order("created_at", { ascending: false });

  return (data ?? []).filter((lead) => {
    const preview = lead.preview as LeadPreview;
    if (!partner.geo_zones.includes(preview.dept ?? "")) return false;
    return (preview.recommended_for ?? []).includes(partner.type);
  }) as MarketplaceLeadRow[];
}

export async function getPurchasedLeadsForPartner(partnerId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  const { data } = await supabase
    .from("lead_purchases")
    .select("*, marketplace_leads(*)")
    .eq("partner_id", partnerId)
    .eq("status", "completed")
    .order("purchased_at", { ascending: false });

  return data ?? [];
}

export async function purchaseLeadRpc(partnerId: string, leadId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase.rpc("purchase_lead", {
    p_partner_id: partnerId,
    p_lead_id: leadId,
  });

  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function grantPartnerCredits(
  partnerId: string,
  amount: number,
  reason: string,
  referenceId?: string
) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("Supabase not configured");

  const { data, error } = await supabase.rpc("grant_partner_credits", {
    p_partner_id: partnerId,
    p_amount: amount,
    p_reason: reason,
    p_reference_id: referenceId ?? null,
  });

  if (error) throw error;
  return data as number;
}

export async function getMarketplaceLeadById(leadId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data } = await supabase.from("marketplace_leads").select("*").eq("id", leadId).single();
  return data as MarketplaceLeadRow | null;
}

export async function getTenantConfig(tenantId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return { id: tenantId, name: "Clarté", primary_color: "#0c8ce9" };
  }
  const { data } = await supabase.from("tenants").select("*").eq("id", tenantId).single();
  return data ?? { id: tenantId, name: "Clarté", primary_color: "#0c8ce9" };
}
