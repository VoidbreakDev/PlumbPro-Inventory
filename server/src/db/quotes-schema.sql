-- PlumbPro Quotes Schema
-- Quoting System for Phase 1 MVP

-- Quotes table (main quote header)
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote_number VARCHAR(50) NOT NULL,

  -- Customer linkage
  customer_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_address TEXT,

  -- Job linkage (optional - quote can be standalone or linked to job)
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

  -- Quote details
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Status workflow: draft -> sent -> approved/rejected/expired
  status VARCHAR(50) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'approved', 'rejected', 'expired', 'converted')),

  -- Validity
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,

  -- Financial
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  discount_type VARCHAR(20) DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
  discount_value DECIMAL(12, 2) DEFAULT 0,
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  tax_rate DECIMAL(5, 2) DEFAULT 10.00, -- GST rate (Australia = 10%)
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,

  -- Markup control
  default_markup_percentage DECIMAL(5, 2) DEFAULT 0,

  -- Terms and conditions
  terms TEXT,
  notes TEXT, -- Internal notes (not shown to customer)
  customer_notes TEXT, -- Notes visible to customer

  -- Approval workflow
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  rejection_reason TEXT,

  -- Tracking
  sent_at TIMESTAMP,
  viewed_at TIMESTAMP,
  responded_at TIMESTAMP,
  converted_to_invoice_id UUID, -- Link to invoice when converted

  -- Version control
  version INTEGER DEFAULT 1,
  parent_quote_id UUID REFERENCES quotes(id), -- For quote revisions

  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for quotes
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_job_id ON quotes(job_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at);

-- Quote line items (materials, labor, other charges)
CREATE TABLE IF NOT EXISTS quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,

  -- Item type: material, labor, other
  item_type VARCHAR(20) NOT NULL DEFAULT 'material'
    CHECK (item_type IN ('material', 'labor', 'other', 'subcontractor')),

  -- Inventory item link (for materials)
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,

  -- Item details (stored for quote snapshot)
  item_name VARCHAR(255) NOT NULL,
  item_description TEXT,
  item_code VARCHAR(100), -- Supplier code or internal code

  -- Quantity and pricing
  quantity DECIMAL(10, 3) NOT NULL DEFAULT 1,
  unit VARCHAR(20) DEFAULT 'EA', -- EA, HR, M, M2, M3, etc.

  -- Cost and pricing
  unit_cost DECIMAL(12, 4) DEFAULT 0, -- What we pay (buy price)
  markup_percentage DECIMAL(5, 2) DEFAULT 0,
  unit_price DECIMAL(12, 4) NOT NULL DEFAULT 0, -- What we charge (sell price)

  -- Calculated
  line_total DECIMAL(12, 2) NOT NULL DEFAULT 0, -- quantity * unit_price
  profit_margin DECIMAL(12, 2) DEFAULT 0, -- line_total - (quantity * unit_cost)

  -- Display order
  sort_order INTEGER DEFAULT 0,

  -- Grouping (for organized display)
  group_name VARCHAR(100),

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for quote items
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_inventory_item ON quote_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_type ON quote_items(item_type);

-- Quote history (audit trail)
CREATE TABLE IF NOT EXISTS quote_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),

  action VARCHAR(50) NOT NULL, -- created, updated, sent, viewed, approved, rejected, expired, converted
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  notes TEXT,

  -- Snapshot of financial data at time of action
  total_at_action DECIMAL(12, 2),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quote_history_quote_id ON quote_history(quote_id);

-- Quote templates (reusable quote structures)
CREATE TABLE IF NOT EXISTS quote_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Default values
  default_terms TEXT,
  default_customer_notes TEXT,
  default_validity_days INTEGER DEFAULT 30,
  default_markup_percentage DECIMAL(5, 2) DEFAULT 0,

  -- Template can be for specific job types
  job_type VARCHAR(100),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quote_templates_user_id ON quote_templates(user_id);

-- Quote template items
CREATE TABLE IF NOT EXISTS quote_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES quote_templates(id) ON DELETE CASCADE,

  item_type VARCHAR(20) NOT NULL DEFAULT 'material',
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  item_description TEXT,

  default_quantity DECIMAL(10, 3) DEFAULT 1,
  unit VARCHAR(20) DEFAULT 'EA',
  default_markup_percentage DECIMAL(5, 2) DEFAULT 0,

  sort_order INTEGER DEFAULT 0,
  group_name VARCHAR(100),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quote_template_items_template ON quote_template_items(template_id);

-- Quote number sequence (for auto-generating quote numbers)
CREATE TABLE IF NOT EXISTS quote_number_sequence (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  prefix VARCHAR(20) DEFAULT 'Q',
  current_number INTEGER DEFAULT 0,
  format VARCHAR(50) DEFAULT '{prefix}-{year}-{number}' -- e.g., Q-2024-0001
);

-- Function to generate next quote number
CREATE OR REPLACE FUNCTION generate_quote_number(p_user_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR(20);
  v_current INTEGER;
  v_year VARCHAR(4);
  v_number VARCHAR(50);
BEGIN
  -- Initialize sequence if not exists
  INSERT INTO quote_number_sequence (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get and increment the sequence
  UPDATE quote_number_sequence
  SET current_number = current_number + 1
  WHERE user_id = p_user_id
  RETURNING prefix, current_number INTO v_prefix, v_current;

  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
  v_number := v_prefix || '-' || v_year || '-' || LPAD(v_current::VARCHAR, 4, '0');

  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_quote_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_quotes_updated_at ON quotes;
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_quote_updated_at();

DROP TRIGGER IF EXISTS update_quote_items_updated_at ON quote_items;
CREATE TRIGGER update_quote_items_updated_at
  BEFORE UPDATE ON quote_items
  FOR EACH ROW EXECUTE FUNCTION update_quote_updated_at();

DROP TRIGGER IF EXISTS update_quote_templates_updated_at ON quote_templates;
CREATE TRIGGER update_quote_templates_updated_at
  BEFORE UPDATE ON quote_templates
  FOR EACH ROW EXECUTE FUNCTION update_quote_updated_at();

-- Function to recalculate quote totals
CREATE OR REPLACE FUNCTION recalculate_quote_totals(p_quote_id UUID)
RETURNS VOID AS $$
DECLARE
  v_subtotal DECIMAL(12, 2);
  v_discount_type VARCHAR(20);
  v_discount_value DECIMAL(12, 2);
  v_discount_amount DECIMAL(12, 2);
  v_tax_rate DECIMAL(5, 2);
  v_tax_amount DECIMAL(12, 2);
  v_total DECIMAL(12, 2);
BEGIN
  -- Calculate subtotal from items
  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
  FROM quote_items WHERE quote_id = p_quote_id;

  -- Get quote discount settings
  SELECT discount_type, discount_value, tax_rate
  INTO v_discount_type, v_discount_value, v_tax_rate
  FROM quotes WHERE id = p_quote_id;

  -- Calculate discount
  IF v_discount_type = 'percentage' THEN
    v_discount_amount := v_subtotal * (v_discount_value / 100);
  ELSE
    v_discount_amount := COALESCE(v_discount_value, 0);
  END IF;

  -- Calculate tax (on subtotal minus discount)
  v_tax_amount := (v_subtotal - v_discount_amount) * (v_tax_rate / 100);

  -- Calculate total
  v_total := v_subtotal - v_discount_amount + v_tax_amount;

  -- Update quote
  UPDATE quotes
  SET subtotal = v_subtotal,
      discount_amount = v_discount_amount,
      tax_amount = v_tax_amount,
      total = v_total
  WHERE id = p_quote_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate totals when items change
CREATE OR REPLACE FUNCTION trigger_recalculate_quote_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_quote_totals(OLD.quote_id);
    RETURN OLD;
  ELSE
    PERFORM recalculate_quote_totals(NEW.quote_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recalc_quote_totals_on_item_change ON quote_items;
CREATE TRIGGER recalc_quote_totals_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON quote_items
  FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_quote_totals();
