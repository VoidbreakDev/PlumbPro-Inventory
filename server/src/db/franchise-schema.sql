-- Franchise Management Schema
-- Multi-tenant architecture for franchise operations

-- Franchise networks (parent organizations)
CREATE TABLE IF NOT EXISTS franchise_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Network details
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,  -- Short code like "PLUMBPRO-US"
  legal_name VARCHAR(255),

  -- Branding
  logo_url TEXT,
  primary_color VARCHAR(7),  -- Hex color
  secondary_color VARCHAR(7),
  accent_color VARCHAR(7),

  -- Contact
  headquarters_address TEXT,
  headquarters_city VARCHAR(100),
  headquarters_state VARCHAR(100),
  headquarters_postal_code VARCHAR(20),
  headquarters_country VARCHAR(100) DEFAULT 'United Kingdom',
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),

  -- Settings
  default_currency VARCHAR(3) DEFAULT 'GBP',
  default_timezone VARCHAR(50) DEFAULT 'Europe/London',
  fiscal_year_start INTEGER DEFAULT 1,  -- Month (1-12)

  -- White-label settings (JSONB for flexibility)
  white_label_config JSONB DEFAULT '{
    "enabled": false,
    "customDomain": null,
    "hideParentBranding": false,
    "customEmailDomain": null,
    "customSupportEmail": null,
    "customTermsUrl": null,
    "customPrivacyUrl": null
  }'::jsonb,

  -- Royalty settings
  royalty_type VARCHAR(20) DEFAULT 'percentage'
    CHECK (royalty_type IN ('percentage', 'fixed', 'tiered', 'none')),
  royalty_percentage DECIMAL(5, 2),
  royalty_fixed_amount DECIMAL(10, 2),
  royalty_tiers JSONB,  -- For tiered royalty structures

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Franchise locations (individual franchisees)
CREATE TABLE IF NOT EXISTS franchise_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES franchise_networks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- Owner account

  -- Location details
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,  -- Location code like "LON-001"
  legal_entity_name VARCHAR(255),
  business_registration_number VARCHAR(100),
  vat_number VARCHAR(50),

  -- Address
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'United Kingdom',
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),

  -- Contact
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),

  -- Territory assignment
  territory_id UUID,  -- References franchise_territories

  -- Financial
  currency VARCHAR(3) DEFAULT 'GBP',
  royalty_override_type VARCHAR(20)
    CHECK (royalty_override_type IN ('percentage', 'fixed', 'tiered', NULL)),
  royalty_override_percentage DECIMAL(5, 2),
  royalty_override_fixed DECIMAL(10, 2),

  -- Performance metrics (cached for quick access)
  monthly_revenue DECIMAL(12, 2) DEFAULT 0,
  monthly_jobs_completed INTEGER DEFAULT 0,
  customer_satisfaction_score DECIMAL(3, 2),  -- 0.00 to 5.00
  compliance_score DECIMAL(5, 2) DEFAULT 100,  -- 0 to 100

  -- Status
  status VARCHAR(50) DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'suspended', 'terminated')),
  opened_date DATE,
  termination_date DATE,

  -- White-label overrides
  white_label_overrides JSONB DEFAULT '{}'::jsonb,

  -- Custom settings per location
  settings JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(network_id, code)
);

-- Franchise territories
CREATE TABLE IF NOT EXISTS franchise_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES franchise_networks(id) ON DELETE CASCADE,

  -- Territory details
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT,

  -- Geographic definition
  boundary_type VARCHAR(20) DEFAULT 'postal_codes'
    CHECK (boundary_type IN ('postal_codes', 'polygon', 'radius', 'custom')),
  postal_codes TEXT[],  -- Array of postal codes
  boundary_polygon JSONB,  -- GeoJSON polygon
  center_lat DECIMAL(10, 8),
  center_lng DECIMAL(11, 8),
  radius_km DECIMAL(10, 2),

  -- Assignment
  assigned_to_location_id UUID REFERENCES franchise_locations(id) ON DELETE SET NULL,
  is_exclusive BOOLEAN DEFAULT true,

  -- Population/market data
  estimated_population INTEGER,
  estimated_households INTEGER,
  market_potential_score DECIMAL(5, 2),

  -- Status
  is_available BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(network_id, code)
);

-- Add foreign key for territory_id after franchise_territories is created
ALTER TABLE franchise_locations
  DROP CONSTRAINT IF EXISTS fk_franchise_locations_territory;
ALTER TABLE franchise_locations
  ADD CONSTRAINT fk_franchise_locations_territory
  FOREIGN KEY (territory_id) REFERENCES franchise_territories(id) ON DELETE SET NULL;

-- Franchise leads (centralized lead distribution)
CREATE TABLE IF NOT EXISTS franchise_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES franchise_networks(id) ON DELETE CASCADE,

  -- Customer info
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),

  -- Address (for territory matching)
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'United Kingdom',
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),

  -- Lead details
  service_type VARCHAR(100),
  description TEXT,
  urgency VARCHAR(20) DEFAULT 'normal'
    CHECK (urgency IN ('low', 'normal', 'high', 'emergency')),
  estimated_value DECIMAL(10, 2),

  -- Source tracking
  source VARCHAR(100),  -- website, phone, referral, marketing, etc.
  source_details JSONB,
  campaign_id VARCHAR(100),

  -- Assignment
  matched_territory_id UUID REFERENCES franchise_territories(id) ON DELETE SET NULL,
  assigned_location_id UUID REFERENCES franchise_locations(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP,
  assignment_method VARCHAR(50)
    CHECK (assignment_method IN ('territory', 'manual', 'round_robin', 'load_balanced', 'auction')),

  -- Response tracking
  status VARCHAR(50) DEFAULT 'new'
    CHECK (status IN ('new', 'assigned', 'contacted', 'quoted', 'won', 'lost', 'expired')),
  first_response_at TIMESTAMP,
  response_time_minutes INTEGER,

  -- Outcome
  outcome_notes TEXT,
  job_id UUID,  -- Reference to jobs table if converted
  quote_amount DECIMAL(10, 2),
  final_amount DECIMAL(10, 2),

  -- Timestamps
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Royalty transactions
CREATE TABLE IF NOT EXISTS franchise_royalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES franchise_networks(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES franchise_locations(id) ON DELETE CASCADE,

  -- Period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type VARCHAR(20) DEFAULT 'monthly'
    CHECK (period_type IN ('weekly', 'bi-weekly', 'monthly', 'quarterly')),

  -- Revenue basis
  gross_revenue DECIMAL(12, 2) NOT NULL,
  deductions DECIMAL(12, 2) DEFAULT 0,
  taxable_revenue DECIMAL(12, 2) NOT NULL,

  -- Calculation
  royalty_type VARCHAR(20) NOT NULL,
  royalty_rate DECIMAL(5, 2),
  royalty_amount DECIMAL(10, 2) NOT NULL,

  -- Additional fees
  marketing_fund_amount DECIMAL(10, 2) DEFAULT 0,
  technology_fee DECIMAL(10, 2) DEFAULT 0,
  other_fees DECIMAL(10, 2) DEFAULT 0,
  other_fees_description TEXT,

  -- Total
  total_due DECIMAL(10, 2) NOT NULL,

  -- Payment
  status VARCHAR(50) DEFAULT 'pending'
    CHECK (status IN ('pending', 'invoiced', 'paid', 'overdue', 'disputed', 'waived')),
  invoice_number VARCHAR(100),
  invoice_date DATE,
  due_date DATE,
  paid_date DATE,
  paid_amount DECIMAL(10, 2),
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),

  -- Notes
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(location_id, period_start, period_end)
);

-- Franchise compliance requirements
CREATE TABLE IF NOT EXISTS franchise_compliance_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES franchise_networks(id) ON DELETE CASCADE,

  -- Requirement details
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,  -- branding, operations, safety, training, etc.
  description TEXT,

  -- Frequency
  frequency VARCHAR(50) DEFAULT 'annual'
    CHECK (frequency IN ('one_time', 'daily', 'weekly', 'monthly', 'quarterly', 'annual')),

  -- Evidence required
  evidence_type VARCHAR(50)
    CHECK (evidence_type IN ('document', 'photo', 'checklist', 'attestation', 'inspection')),
  evidence_template JSONB,

  -- Scoring
  weight INTEGER DEFAULT 1,  -- Importance weight for compliance score
  is_critical BOOLEAN DEFAULT false,  -- Critical failures = immediate non-compliance

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Franchise compliance submissions
CREATE TABLE IF NOT EXISTS franchise_compliance_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL REFERENCES franchise_compliance_requirements(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES franchise_locations(id) ON DELETE CASCADE,

  -- Submission details
  period_start DATE,
  period_end DATE,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_by_name VARCHAR(255),

  -- Evidence
  evidence_data JSONB,
  document_urls TEXT[],
  notes TEXT,

  -- Review
  status VARCHAR(50) DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'needs_revision')),
  reviewed_at TIMESTAMP,
  reviewed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by_name VARCHAR(255),
  review_notes TEXT,

  -- Scoring
  score DECIMAL(5, 2),  -- 0 to 100

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Centralized purchasing catalog (items available through network)
CREATE TABLE IF NOT EXISTS franchise_catalog_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES franchise_networks(id) ON DELETE CASCADE,

  -- Item details
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(100),

  -- Pricing
  list_price DECIMAL(10, 2) NOT NULL,
  franchise_price DECIMAL(10, 2) NOT NULL,  -- Discounted price for franchisees
  min_order_quantity INTEGER DEFAULT 1,

  -- Supplier
  supplier_id UUID,  -- References contacts table
  supplier_name VARCHAR(255),
  supplier_sku VARCHAR(100),

  -- Images
  image_url TEXT,

  -- Availability
  is_required BOOLEAN DEFAULT false,  -- Required for brand compliance
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(network_id, sku)
);

-- Franchise purchase orders (centralized ordering)
CREATE TABLE IF NOT EXISTS franchise_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES franchise_networks(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES franchise_locations(id) ON DELETE CASCADE,

  -- Order details
  order_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'processing', 'shipped', 'delivered', 'cancelled')),

  -- Totals
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  shipping_amount DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,

  -- Shipping
  shipping_address TEXT,
  shipping_method VARCHAR(100),
  tracking_number VARCHAR(255),
  estimated_delivery DATE,
  actual_delivery DATE,

  -- Payment
  payment_status VARCHAR(50) DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),

  -- Dates
  submitted_at TIMESTAMP,
  approved_at TIMESTAMP,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,

  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(network_id, order_number)
);

-- Franchise purchase order items
CREATE TABLE IF NOT EXISTS franchise_purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES franchise_purchase_orders(id) ON DELETE CASCADE,
  catalog_item_id UUID NOT NULL REFERENCES franchise_catalog_items(id) ON DELETE CASCADE,

  -- Item details (snapshot at time of order)
  item_name VARCHAR(255) NOT NULL,
  item_sku VARCHAR(100) NOT NULL,

  -- Quantities
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,

  -- Fulfillment
  quantity_shipped INTEGER DEFAULT 0,
  quantity_received INTEGER DEFAULT 0,

  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Franchise announcements/communications
CREATE TABLE IF NOT EXISTS franchise_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id UUID NOT NULL REFERENCES franchise_networks(id) ON DELETE CASCADE,

  -- Announcement details
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100),  -- news, policy, training, marketing, urgent
  priority VARCHAR(20) DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Targeting
  target_all_locations BOOLEAN DEFAULT true,
  target_location_ids UUID[],
  target_territory_ids UUID[],

  -- Visibility
  publish_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  is_pinned BOOLEAN DEFAULT false,

  -- Tracking
  requires_acknowledgment BOOLEAN DEFAULT false,

  -- Author
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name VARCHAR(255),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Announcement acknowledgments
CREATE TABLE IF NOT EXISTS franchise_announcement_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES franchise_announcements(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES franchise_locations(id) ON DELETE CASCADE,

  acknowledged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  acknowledged_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_by_name VARCHAR(255),

  UNIQUE(announcement_id, location_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_franchise_networks_code ON franchise_networks(code);
CREATE INDEX IF NOT EXISTS idx_franchise_networks_active ON franchise_networks(is_active);

CREATE INDEX IF NOT EXISTS idx_franchise_locations_network ON franchise_locations(network_id);
CREATE INDEX IF NOT EXISTS idx_franchise_locations_user ON franchise_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_franchise_locations_territory ON franchise_locations(territory_id);
CREATE INDEX IF NOT EXISTS idx_franchise_locations_status ON franchise_locations(network_id, status);

CREATE INDEX IF NOT EXISTS idx_franchise_territories_network ON franchise_territories(network_id);
CREATE INDEX IF NOT EXISTS idx_franchise_territories_location ON franchise_territories(assigned_to_location_id);

CREATE INDEX IF NOT EXISTS idx_franchise_leads_network ON franchise_leads(network_id);
CREATE INDEX IF NOT EXISTS idx_franchise_leads_location ON franchise_leads(assigned_location_id);
CREATE INDEX IF NOT EXISTS idx_franchise_leads_territory ON franchise_leads(matched_territory_id);
CREATE INDEX IF NOT EXISTS idx_franchise_leads_status ON franchise_leads(network_id, status);
CREATE INDEX IF NOT EXISTS idx_franchise_leads_postal ON franchise_leads(postal_code);

CREATE INDEX IF NOT EXISTS idx_franchise_royalties_network ON franchise_royalties(network_id);
CREATE INDEX IF NOT EXISTS idx_franchise_royalties_location ON franchise_royalties(location_id);
CREATE INDEX IF NOT EXISTS idx_franchise_royalties_period ON franchise_royalties(location_id, period_start);
CREATE INDEX IF NOT EXISTS idx_franchise_royalties_status ON franchise_royalties(network_id, status);

CREATE INDEX IF NOT EXISTS idx_compliance_requirements_network ON franchise_compliance_requirements(network_id);
CREATE INDEX IF NOT EXISTS idx_compliance_submissions_requirement ON franchise_compliance_submissions(requirement_id);
CREATE INDEX IF NOT EXISTS idx_compliance_submissions_location ON franchise_compliance_submissions(location_id);
CREATE INDEX IF NOT EXISTS idx_compliance_submissions_status ON franchise_compliance_submissions(status);

CREATE INDEX IF NOT EXISTS idx_catalog_items_network ON franchise_catalog_items(network_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_network ON franchise_purchase_orders(network_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_location ON franchise_purchase_orders(location_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON franchise_purchase_orders(network_id, status);

CREATE INDEX IF NOT EXISTS idx_announcements_network ON franchise_announcements(network_id);
CREATE INDEX IF NOT EXISTS idx_announcements_publish ON franchise_announcements(network_id, publish_at);

-- Triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_franchise_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_franchise_networks_timestamp ON franchise_networks;
CREATE TRIGGER update_franchise_networks_timestamp
  BEFORE UPDATE ON franchise_networks
  FOR EACH ROW EXECUTE FUNCTION update_franchise_timestamp();

DROP TRIGGER IF EXISTS update_franchise_locations_timestamp ON franchise_locations;
CREATE TRIGGER update_franchise_locations_timestamp
  BEFORE UPDATE ON franchise_locations
  FOR EACH ROW EXECUTE FUNCTION update_franchise_timestamp();

DROP TRIGGER IF EXISTS update_franchise_territories_timestamp ON franchise_territories;
CREATE TRIGGER update_franchise_territories_timestamp
  BEFORE UPDATE ON franchise_territories
  FOR EACH ROW EXECUTE FUNCTION update_franchise_timestamp();

DROP TRIGGER IF EXISTS update_franchise_leads_timestamp ON franchise_leads;
CREATE TRIGGER update_franchise_leads_timestamp
  BEFORE UPDATE ON franchise_leads
  FOR EACH ROW EXECUTE FUNCTION update_franchise_timestamp();

DROP TRIGGER IF EXISTS update_franchise_royalties_timestamp ON franchise_royalties;
CREATE TRIGGER update_franchise_royalties_timestamp
  BEFORE UPDATE ON franchise_royalties
  FOR EACH ROW EXECUTE FUNCTION update_franchise_timestamp();

-- Comments
COMMENT ON TABLE franchise_networks IS 'Parent franchise organizations';
COMMENT ON TABLE franchise_locations IS 'Individual franchise locations/franchisees';
COMMENT ON TABLE franchise_territories IS 'Geographic territories assigned to franchisees';
COMMENT ON TABLE franchise_leads IS 'Centralized leads distributed to franchisees';
COMMENT ON TABLE franchise_royalties IS 'Royalty calculations and payments';
COMMENT ON TABLE franchise_compliance_requirements IS 'Brand compliance requirements';
COMMENT ON TABLE franchise_compliance_submissions IS 'Franchisee compliance evidence submissions';
COMMENT ON TABLE franchise_catalog_items IS 'Centralized purchasing catalog';
COMMENT ON TABLE franchise_purchase_orders IS 'Franchisee orders from central catalog';
COMMENT ON TABLE franchise_announcements IS 'Network-wide communications';
