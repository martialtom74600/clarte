-- Supabase schema for Clarté separation simulator

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#0c8ce9',
  webhook_url TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO tenants (id, name) VALUES ('default', 'Clarté')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT REFERENCES tenants(id) DEFAULT 'default',
  input_data JSONB NOT NULL,
  result_data JSONB NOT NULL,
  share_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_simulations_share_token ON simulations(share_token);
CREATE INDEX IF NOT EXISTS idx_simulations_tenant ON simulations(tenant_id);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  tenant_id TEXT REFERENCES tenants(id) DEFAULT 'default',
  score INTEGER NOT NULL,
  tier TEXT NOT NULL,
  qualifies_for_cpl BOOLEAN DEFAULT FALSE,
  recommended_partners TEXT[] DEFAULT '{}',
  simulation_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);

ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
