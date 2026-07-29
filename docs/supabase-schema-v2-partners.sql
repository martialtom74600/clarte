-- Clarté Pro — Marketplace B2B schema (v2)
-- Run after supabase-schema.sql

CREATE TYPE partner_type AS ENUM ('notaire', 'courtier', 'agence');
CREATE TYPE lead_status AS ENUM ('available', 'sold', 'expired');
CREATE TYPE purchase_status AS ENUM ('pending', 'completed', 'refunded');

CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type partner_type NOT NULL,
  company_name TEXT NOT NULL,
  siret TEXT,
  geo_zones TEXT[] NOT NULL DEFAULT '{}',
  stripe_customer_id TEXT UNIQUE,
  credit_balance INTEGER NOT NULL DEFAULT 0 CHECK (credit_balance >= 0),
  subscription_id TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS partner_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partner_users_partner ON partner_users(partner_id);

CREATE TABLE IF NOT EXISTS marketplace_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id TEXT DEFAULT 'default',
  simulation_id UUID REFERENCES simulations(id),
  preview JSONB NOT NULL,
  contact JSONB NOT NULL,
  status lead_status DEFAULT 'available',
  credit_price INTEGER NOT NULL DEFAULT 1 CHECK (credit_price >= 1),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_status ON marketplace_leads(status);
CREATE INDEX IF NOT EXISTS idx_ml_dept ON marketplace_leads((preview->>'dept'));
CREATE INDEX IF NOT EXISTS idx_ml_created ON marketplace_leads(created_at DESC);

CREATE TABLE IF NOT EXISTS lead_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id),
  lead_id UUID NOT NULL REFERENCES marketplace_leads(id),
  credits_spent INTEGER NOT NULL,
  stripe_payment_intent_id TEXT,
  status purchase_status DEFAULT 'completed',
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id)
);

CREATE INDEX IF NOT EXISTS idx_lp_partner ON lead_purchases(partner_id);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id),
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ct_partner ON credit_transactions(partner_id);

-- RPC: achat atomique single-buy
CREATE OR REPLACE FUNCTION purchase_lead(
  p_partner_id UUID,
  p_lead_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lead marketplace_leads%ROWTYPE;
  v_partner partners%ROWTYPE;
  v_partner_type partner_type;
  v_recommended JSONB;
BEGIN
  SELECT * INTO v_partner FROM partners WHERE id = p_partner_id FOR UPDATE;
  IF NOT FOUND OR v_partner.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'PARTNER_NOT_FOUND';
  END IF;

  SELECT * INTO v_lead FROM marketplace_leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEAD_NOT_FOUND';
  END IF;
  IF v_lead.status != 'available' THEN
    RAISE EXCEPTION 'LEAD_NOT_AVAILABLE';
  END IF;
  IF v_lead.expires_at IS NOT NULL AND v_lead.expires_at < NOW() THEN
    UPDATE marketplace_leads SET status = 'expired' WHERE id = p_lead_id;
    RAISE EXCEPTION 'LEAD_EXPIRED';
  END IF;

  IF NOT ((v_lead.preview->>'dept') = ANY(v_partner.geo_zones)) THEN
    RAISE EXCEPTION 'GEO_MISMATCH';
  END IF;

  v_recommended := v_lead.preview->'recommended_for';
  SELECT type INTO v_partner_type FROM partners WHERE id = p_partner_id;
  IF NOT (v_recommended @> to_jsonb(v_partner_type::TEXT)) THEN
    RAISE EXCEPTION 'TYPE_MISMATCH';
  END IF;

  IF v_partner.credit_balance < v_lead.credit_price THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
  END IF;

  UPDATE partners
  SET credit_balance = credit_balance - v_lead.credit_price
  WHERE id = p_partner_id;

  UPDATE marketplace_leads SET status = 'sold' WHERE id = p_lead_id;

  INSERT INTO lead_purchases (partner_id, lead_id, credits_spent, status)
  VALUES (p_partner_id, p_lead_id, v_lead.credit_price, 'completed');

  INSERT INTO credit_transactions (partner_id, amount, reason, reference_id)
  VALUES (p_partner_id, -v_lead.credit_price, 'lead_purchase', p_lead_id::TEXT);

  RETURN v_lead.contact;
END;
$$;

-- RPC: créditer un partenaire (webhook Stripe / admin manuel)
CREATE OR REPLACE FUNCTION grant_partner_credits(
  p_partner_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_reference_id TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  UPDATE partners
  SET credit_balance = credit_balance + p_amount
  WHERE id = p_partner_id
  RETURNING credit_balance INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PARTNER_NOT_FOUND';
  END IF;

  INSERT INTO credit_transactions (partner_id, amount, reason, reference_id)
  VALUES (p_partner_id, p_amount, p_reason, p_reference_id);

  RETURN v_new_balance;
END;
$$;

-- RLS
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- B2C leads table extension
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone TEXT;

-- Partner users can read their partner row
CREATE POLICY partner_read_self ON partners FOR SELECT
  USING (id IN (SELECT partner_id FROM partner_users WHERE id = auth.uid()));

-- Preview: available leads in geo zone (contact stripped server-side in API)
CREATE POLICY partner_leads_preview ON marketplace_leads FOR SELECT
  USING (
    status = 'available'
    AND (preview->>'dept') IN (
      SELECT unnest(p.geo_zones) FROM partners p
      JOIN partner_users pu ON pu.partner_id = p.id
      WHERE pu.id = auth.uid()
    )
  );

-- Contact: only purchased leads
CREATE POLICY partner_leads_purchased ON marketplace_leads FOR SELECT
  USING (
    id IN (
      SELECT lp.lead_id FROM lead_purchases lp
      JOIN partner_users pu ON pu.partner_id = lp.partner_id
      WHERE pu.id = auth.uid() AND lp.status = 'completed'
    )
  );

CREATE POLICY partner_purchases_read ON lead_purchases FOR SELECT
  USING (partner_id IN (SELECT partner_id FROM partner_users WHERE id = auth.uid()));

CREATE POLICY partner_credits_read ON credit_transactions FOR SELECT
  USING (partner_id IN (SELECT partner_id FROM partner_users WHERE id = auth.uid()));

-- Seed example beta partner (adjust UUIDs after creating auth user)
-- INSERT INTO partners (id, type, company_name, geo_zones, credit_balance)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'notaire', 'Étude Demo Paris', ARRAY['75','92','93'], 10);
