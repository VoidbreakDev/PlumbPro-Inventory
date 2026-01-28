-- White-Label Configuration Schema
-- Domain verification and additional white-label settings

-- Domain verifications table
CREATE TABLE IF NOT EXISTS domain_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) NOT NULL UNIQUE,
  network_id UUID REFERENCES franchise_networks(id) ON DELETE CASCADE,
  organization_id UUID,  -- For non-franchise white-labeling

  -- Verification details
  verification_method VARCHAR(20) NOT NULL
    CHECK (verification_method IN ('dns_txt', 'dns_cname', 'file')),
  verification_token VARCHAR(255) NOT NULL,

  -- Status
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'failed', 'expired')),
  verified_at TIMESTAMP,
  error TEXT,

  -- SSL certificate info (if managed)
  ssl_status VARCHAR(20)
    CHECK (ssl_status IN ('none', 'pending', 'active', 'failed', 'expired')),
  ssl_issued_at TIMESTAMP,
  ssl_expires_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email domain verifications (for custom email branding)
CREATE TABLE IF NOT EXISTS email_domain_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(255) NOT NULL UNIQUE,
  network_id UUID REFERENCES franchise_networks(id) ON DELETE CASCADE,
  organization_id UUID,

  -- SPF record
  spf_status VARCHAR(20) DEFAULT 'pending'
    CHECK (spf_status IN ('pending', 'verified', 'failed')),
  spf_record TEXT,

  -- DKIM records
  dkim_status VARCHAR(20) DEFAULT 'pending'
    CHECK (dkim_status IN ('pending', 'verified', 'failed')),
  dkim_selector VARCHAR(100),
  dkim_public_key TEXT,

  -- DMARC record
  dmarc_status VARCHAR(20) DEFAULT 'pending'
    CHECK (dmarc_status IN ('pending', 'verified', 'failed')),
  dmarc_record TEXT,

  -- Overall status
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'partial', 'verified', 'failed')),
  verified_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Custom themes (beyond color presets)
CREATE TABLE IF NOT EXISTS white_label_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID REFERENCES franchise_networks(id) ON DELETE CASCADE,
  organization_id UUID,

  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Colors
  primary_color VARCHAR(7) NOT NULL,
  secondary_color VARCHAR(7) NOT NULL,
  accent_color VARCHAR(7) NOT NULL,

  -- Additional color options
  background_color VARCHAR(7) DEFAULT '#ffffff',
  surface_color VARCHAR(7) DEFAULT '#f8fafc',
  text_color VARCHAR(7) DEFAULT '#1e293b',
  text_muted_color VARCHAR(7) DEFAULT '#64748b',

  -- Typography
  font_family VARCHAR(255) DEFAULT 'Inter, system-ui, sans-serif',
  heading_font_family VARCHAR(255),
  base_font_size INTEGER DEFAULT 16,

  -- Border radius
  border_radius_sm VARCHAR(20) DEFAULT '0.25rem',
  border_radius_md VARCHAR(20) DEFAULT '0.5rem',
  border_radius_lg VARCHAR(20) DEFAULT '1rem',

  -- Shadows
  shadow_sm TEXT DEFAULT '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  shadow_md TEXT DEFAULT '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  shadow_lg TEXT DEFAULT '0 10px 15px -3px rgb(0 0 0 / 0.1)',

  -- Custom CSS
  custom_css TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email templates for white-labeled communications
CREATE TABLE IF NOT EXISTS white_label_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID REFERENCES franchise_networks(id) ON DELETE CASCADE,
  organization_id UUID,

  -- Template identification
  template_key VARCHAR(100) NOT NULL,  -- e.g., 'welcome', 'password_reset', 'invoice'
  name VARCHAR(255) NOT NULL,

  -- Content
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  text_content TEXT,

  -- Variables available in template
  available_variables JSONB DEFAULT '[]'::jsonb,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(network_id, template_key),
  UNIQUE(organization_id, template_key)
);

-- White-label asset library
CREATE TABLE IF NOT EXISTS white_label_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID REFERENCES franchise_networks(id) ON DELETE CASCADE,
  organization_id UUID,

  -- Asset details
  name VARCHAR(255) NOT NULL,
  asset_type VARCHAR(50) NOT NULL
    CHECK (asset_type IN ('logo', 'favicon', 'email_logo', 'banner', 'background', 'icon', 'document')),
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  dimensions JSONB,  -- { width: 200, height: 100 }

  -- Metadata
  alt_text VARCHAR(255),
  description TEXT,

  -- Usage
  is_primary BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_domain_verifications_network ON domain_verifications(network_id);
CREATE INDEX IF NOT EXISTS idx_domain_verifications_status ON domain_verifications(status);

CREATE INDEX IF NOT EXISTS idx_email_domain_verifications_network ON email_domain_verifications(network_id);

CREATE INDEX IF NOT EXISTS idx_white_label_themes_network ON white_label_themes(network_id);
CREATE INDEX IF NOT EXISTS idx_white_label_themes_active ON white_label_themes(network_id, is_active);

CREATE INDEX IF NOT EXISTS idx_email_templates_network ON white_label_email_templates(network_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_key ON white_label_email_templates(template_key);

CREATE INDEX IF NOT EXISTS idx_white_label_assets_network ON white_label_assets(network_id);
CREATE INDEX IF NOT EXISTS idx_white_label_assets_type ON white_label_assets(network_id, asset_type);

-- Triggers
CREATE OR REPLACE FUNCTION update_white_label_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_domain_verifications_timestamp ON domain_verifications;
CREATE TRIGGER update_domain_verifications_timestamp
  BEFORE UPDATE ON domain_verifications
  FOR EACH ROW EXECUTE FUNCTION update_white_label_timestamp();

DROP TRIGGER IF EXISTS update_email_domain_verifications_timestamp ON email_domain_verifications;
CREATE TRIGGER update_email_domain_verifications_timestamp
  BEFORE UPDATE ON email_domain_verifications
  FOR EACH ROW EXECUTE FUNCTION update_white_label_timestamp();

DROP TRIGGER IF EXISTS update_white_label_themes_timestamp ON white_label_themes;
CREATE TRIGGER update_white_label_themes_timestamp
  BEFORE UPDATE ON white_label_themes
  FOR EACH ROW EXECUTE FUNCTION update_white_label_timestamp();

-- Comments
COMMENT ON TABLE domain_verifications IS 'Custom domain verification records for white-labeling';
COMMENT ON TABLE email_domain_verifications IS 'Email domain verification for custom sender addresses';
COMMENT ON TABLE white_label_themes IS 'Custom theme configurations beyond basic color presets';
COMMENT ON TABLE white_label_email_templates IS 'Customizable email templates for white-labeled communications';
COMMENT ON TABLE white_label_assets IS 'Asset library for white-label branding materials';
