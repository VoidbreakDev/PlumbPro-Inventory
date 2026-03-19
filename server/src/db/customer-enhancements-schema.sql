-- PlumbPro Customer Management Enhancements
-- Extends the contacts table for better customer management

-- Add extended fields to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS address_street VARCHAR(255);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS address_city VARCHAR(100);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS address_state VARCHAR(50);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS address_postcode VARCHAR(20);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS address_country VARCHAR(100) DEFAULT 'Australia';

-- Business details
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS abn VARCHAR(20); -- Australian Business Number
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255); -- Separate billing email
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS website VARCHAR(255);

-- Contact person details (for company contacts)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS primary_contact_name VARCHAR(255);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS primary_contact_phone VARCHAR(50);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS primary_contact_email VARCHAR(255);

-- Customer classification
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS customer_type VARCHAR(50) DEFAULT 'residential'
  CHECK (customer_type IN ('residential', 'commercial', 'builder', 'developer', 'government', 'other'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags TEXT[]; -- Array of tags for flexible categorization

-- Customer-specific pricing
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS default_markup_percentage DECIMAL(5, 2);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS default_discount_percentage DECIMAL(5, 2);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS default_payment_terms VARCHAR(20) DEFAULT 'NET30'
  CHECK (default_payment_terms IN ('DUE_ON_RECEIPT', 'NET7', 'NET14', 'NET30', 'NET60', 'CUSTOM'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS custom_payment_days INTEGER;

-- Status and flags
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
  CHECK (status IN ('active', 'inactive', 'blacklisted'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12, 2);

-- Notes and communication
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferred_contact_method VARCHAR(20) DEFAULT 'email'
  CHECK (preferred_contact_method IN ('email', 'phone', 'sms', 'any'));

-- Billing address (if different from main address)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS billing_address_street VARCHAR(255);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS billing_address_city VARCHAR(100);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS billing_address_state VARCHAR(50);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS billing_address_postcode VARCHAR(20);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_contacts_customer_type ON contacts(customer_type) WHERE type = 'Customer';
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_contacts_name_search ON contacts USING GIN(to_tsvector('english', name || ' ' || COALESCE(company, '')));

-- Customer notes/communication log table
CREATE TABLE IF NOT EXISTS customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  note_type VARCHAR(50) NOT NULL DEFAULT 'general'
    CHECK (note_type IN ('general', 'phone_call', 'email', 'meeting', 'site_visit', 'complaint', 'follow_up')),

  subject VARCHAR(255),
  content TEXT NOT NULL,

  -- For follow-up tracking
  is_follow_up_required BOOLEAN DEFAULT false,
  follow_up_date DATE,
  is_follow_up_completed BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_notes_contact ON customer_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_user ON customer_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_follow_up ON customer_notes(follow_up_date) WHERE is_follow_up_required = true AND is_follow_up_completed = false;

-- Service agreements table
CREATE TABLE IF NOT EXISTS service_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  agreement_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Agreement type and status
  agreement_type VARCHAR(50) NOT NULL DEFAULT 'maintenance'
    CHECK (agreement_type IN ('maintenance', 'service', 'warranty', 'support', 'other')),
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'expired', 'cancelled', 'pending_renewal')),

  -- Dates
  start_date DATE NOT NULL,
  end_date DATE,
  next_service_date DATE,

  -- Billing
  billing_frequency VARCHAR(20) DEFAULT 'monthly'
    CHECK (billing_frequency IN ('one_time', 'monthly', 'quarterly', 'semi_annual', 'annual')),
  billing_amount DECIMAL(12, 2),

  -- Service details
  service_frequency VARCHAR(50), -- e.g., "Every 3 months", "Twice yearly"
  included_services TEXT, -- Description of what's covered

  -- Tracking
  total_value DECIMAL(12, 2),
  notes TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_agreements_contact ON service_agreements(contact_id);
CREATE INDEX IF NOT EXISTS idx_service_agreements_user ON service_agreements(user_id);
CREATE INDEX IF NOT EXISTS idx_service_agreements_status ON service_agreements(status);
CREATE INDEX IF NOT EXISTS idx_service_agreements_next_service ON service_agreements(next_service_date) WHERE status = 'active';

-- Service agreement number sequence
CREATE TABLE IF NOT EXISTS service_agreement_sequence (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  prefix VARCHAR(20) DEFAULT 'SA',
  current_number INTEGER DEFAULT 0
);

-- Function to generate next service agreement number
CREATE OR REPLACE FUNCTION generate_agreement_number(p_user_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR(20);
  v_current INTEGER;
  v_year VARCHAR(4);
  v_number VARCHAR(50);
BEGIN
  -- Initialize sequence if not exists
  INSERT INTO service_agreement_sequence (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get and increment the sequence
  UPDATE service_agreement_sequence
  SET current_number = current_number + 1
  WHERE user_id = p_user_id
  RETURNING prefix, current_number INTO v_prefix, v_current;

  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
  v_number := v_prefix || '-' || v_year || '-' || LPAD(v_current::VARCHAR, 4, '0');

  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Customer pricing rules table (for item-specific pricing)
CREATE TABLE IF NOT EXISTS customer_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Can be for specific item or category-wide
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  category VARCHAR(100), -- If set, applies to all items in category

  -- Pricing override
  price_type VARCHAR(20) NOT NULL DEFAULT 'markup'
    CHECK (price_type IN ('fixed', 'markup', 'discount')),
  price_value DECIMAL(12, 4) NOT NULL, -- Fixed price OR percentage

  -- Validity
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure either item_id or category is set, not both
  CONSTRAINT check_pricing_target CHECK (
    (inventory_item_id IS NOT NULL AND category IS NULL) OR
    (inventory_item_id IS NULL AND category IS NOT NULL) OR
    (inventory_item_id IS NULL AND category IS NULL) -- For default customer pricing
  )
);

CREATE INDEX IF NOT EXISTS idx_customer_pricing_contact ON customer_pricing(contact_id);
CREATE INDEX IF NOT EXISTS idx_customer_pricing_item ON customer_pricing(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_customer_pricing_category ON customer_pricing(category);

-- Trigger to update updated_at on contacts
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_contacts_timestamp ON contacts;
CREATE TRIGGER update_contacts_timestamp
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_contacts_updated_at();

-- Trigger to update updated_at on customer_notes
DROP TRIGGER IF EXISTS update_customer_notes_timestamp ON customer_notes;
CREATE TRIGGER update_customer_notes_timestamp
  BEFORE UPDATE ON customer_notes
  FOR EACH ROW EXECUTE FUNCTION update_contacts_updated_at();

-- Trigger to update updated_at on service_agreements
DROP TRIGGER IF EXISTS update_service_agreements_timestamp ON service_agreements;
CREATE TRIGGER update_service_agreements_timestamp
  BEFORE UPDATE ON service_agreements
  FOR EACH ROW EXECUTE FUNCTION update_contacts_updated_at();

-- Add customer_id to jobs if not exists (for linking jobs to customers)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'customer_id'
  ) THEN
    ALTER TABLE jobs ADD COLUMN customer_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
    CREATE INDEX idx_jobs_customer ON jobs(customer_id);
  END IF;
END $$;

-- View to get customer summary statistics
CREATE OR REPLACE VIEW customer_summary AS
SELECT
  c.id as contact_id,
  c.user_id,
  c.name,
  c.company,
  c.customer_type,
  c.status,
  c.is_vip,
  -- Quote stats
  (SELECT COUNT(*) FROM quotes q WHERE q.customer_id = c.id) as total_quotes,
  (SELECT COUNT(*) FROM quotes q WHERE q.customer_id = c.id AND q.status = 'approved') as approved_quotes,
  (SELECT COALESCE(SUM(q.total), 0) FROM quotes q WHERE q.customer_id = c.id AND q.status = 'approved') as approved_quotes_value,
  -- Invoice stats
  (SELECT COUNT(*) FROM invoices i WHERE i.customer_id = c.id) as total_invoices,
  (SELECT COUNT(*) FROM invoices i WHERE i.customer_id = c.id AND i.status = 'paid') as paid_invoices,
  (SELECT COALESCE(SUM(i.total), 0) FROM invoices i WHERE i.customer_id = c.id AND i.status = 'paid') as total_paid,
  (SELECT COALESCE(SUM(i.amount_due), 0) FROM invoices i WHERE i.customer_id = c.id AND i.status NOT IN ('paid', 'void', 'cancelled')) as outstanding_balance,
  (SELECT COUNT(*) FROM invoices i WHERE i.customer_id = c.id AND i.status = 'overdue') as overdue_invoices,
  -- Job stats
  (SELECT COUNT(*) FROM jobs j WHERE j.customer_id = c.id) as total_jobs,
  -- Service agreement stats
  (SELECT COUNT(*) FROM service_agreements sa WHERE sa.contact_id = c.id AND sa.status = 'active') as active_agreements,
  -- Last activity
  (SELECT MAX(created_at) FROM quotes q WHERE q.customer_id = c.id) as last_quote_date,
  (SELECT MAX(created_at) FROM invoices i WHERE i.customer_id = c.id) as last_invoice_date
FROM contacts c
WHERE c.type = 'Customer';
