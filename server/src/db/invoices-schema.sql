-- PlumbPro Invoices Schema
-- Invoicing System for Phase 1 MVP

-- Invoices table (main invoice header)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL,

  -- Customer linkage
  customer_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_address TEXT,
  customer_abn VARCHAR(20), -- Australian Business Number

  -- Source linkage
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,

  -- Invoice details
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Status workflow: draft -> sent -> viewed -> paid/overdue/cancelled
  status VARCHAR(50) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled', 'void')),

  -- Dates
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  payment_terms VARCHAR(20) DEFAULT 'NET30' CHECK (payment_terms IN ('DUE_ON_RECEIPT', 'NET7', 'NET14', 'NET30', 'NET60', 'CUSTOM')),
  custom_terms_days INTEGER,

  -- Financial - amounts
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  discount_type VARCHAR(20) DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
  discount_value DECIMAL(12, 2) DEFAULT 0,
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  tax_rate DECIMAL(5, 2) DEFAULT 10.00, -- GST rate (Australia = 10%)
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) NOT NULL DEFAULT 0,

  -- Payment tracking
  amount_paid DECIMAL(12, 2) DEFAULT 0,
  amount_due DECIMAL(12, 2) GENERATED ALWAYS AS (total - amount_paid) STORED,

  -- Terms and notes
  terms TEXT,
  notes TEXT, -- Internal notes
  customer_notes TEXT, -- Notes visible to customer
  payment_instructions TEXT,

  -- Bank details for payment
  bank_name VARCHAR(100),
  bank_account_name VARCHAR(255),
  bank_bsb VARCHAR(20),
  bank_account_number VARCHAR(50),

  -- Tracking
  sent_at TIMESTAMP,
  viewed_at TIMESTAMP,
  paid_at TIMESTAMP,
  last_payment_date TIMESTAMP,
  last_reminder_sent_at TIMESTAMP,
  reminder_count INTEGER DEFAULT 0,

  -- Progress invoicing
  is_progress_invoice BOOLEAN DEFAULT false,
  progress_percentage DECIMAL(5, 2),
  parent_invoice_id UUID REFERENCES invoices(id),

  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quote_id ON invoices(quote_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

-- Invoice line items
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  -- Item type
  item_type VARCHAR(20) NOT NULL DEFAULT 'material'
    CHECK (item_type IN ('material', 'labor', 'other', 'subcontractor')),

  -- Inventory item link
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,

  -- Item details
  item_name VARCHAR(255) NOT NULL,
  item_description TEXT,
  item_code VARCHAR(100),

  -- Quantity and pricing
  quantity DECIMAL(10, 3) NOT NULL DEFAULT 1,
  unit VARCHAR(20) DEFAULT 'EA',
  unit_price DECIMAL(12, 4) NOT NULL DEFAULT 0,
  line_total DECIMAL(12, 2) NOT NULL DEFAULT 0,

  -- Tax
  is_taxable BOOLEAN DEFAULT true,

  -- Display
  sort_order INTEGER DEFAULT 0,
  group_name VARCHAR(100),

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for invoice items
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_inventory_item ON invoice_items(inventory_item_id);

-- Invoice payments
CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),

  -- Payment details
  amount DECIMAL(12, 2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer'
    CHECK (payment_method IN ('cash', 'cheque', 'bank_transfer', 'credit_card', 'eftpos', 'paypal', 'stripe', 'other')),

  -- Reference
  reference_number VARCHAR(100),
  notes TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_date ON invoice_payments(payment_date);

-- Invoice history (audit trail)
CREATE TABLE IF NOT EXISTS invoice_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),

  action VARCHAR(50) NOT NULL,
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  notes TEXT,

  -- Financial snapshot
  total_at_action DECIMAL(12, 2),
  amount_paid_at_action DECIMAL(12, 2),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_history_invoice_id ON invoice_history(invoice_id);

-- Invoice number sequence
CREATE TABLE IF NOT EXISTS invoice_number_sequence (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  prefix VARCHAR(20) DEFAULT 'INV',
  current_number INTEGER DEFAULT 0,
  format VARCHAR(50) DEFAULT '{prefix}-{year}-{number}'
);

-- Function to generate next invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number(p_user_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR(20);
  v_current INTEGER;
  v_year VARCHAR(4);
  v_number VARCHAR(50);
BEGIN
  -- Initialize sequence if not exists
  INSERT INTO invoice_number_sequence (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get and increment the sequence
  UPDATE invoice_number_sequence
  SET current_number = current_number + 1
  WHERE user_id = p_user_id
  RETURNING prefix, current_number INTO v_prefix, v_current;

  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
  v_number := v_prefix || '-' || v_year || '-' || LPAD(v_current::VARCHAR, 4, '0');

  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate due date from payment terms
CREATE OR REPLACE FUNCTION calculate_due_date(
  p_invoice_date DATE,
  p_payment_terms VARCHAR(20),
  p_custom_days INTEGER DEFAULT NULL
)
RETURNS DATE AS $$
BEGIN
  CASE p_payment_terms
    WHEN 'DUE_ON_RECEIPT' THEN RETURN p_invoice_date;
    WHEN 'NET7' THEN RETURN p_invoice_date + INTERVAL '7 days';
    WHEN 'NET14' THEN RETURN p_invoice_date + INTERVAL '14 days';
    WHEN 'NET30' THEN RETURN p_invoice_date + INTERVAL '30 days';
    WHEN 'NET60' THEN RETURN p_invoice_date + INTERVAL '60 days';
    WHEN 'CUSTOM' THEN RETURN p_invoice_date + (COALESCE(p_custom_days, 30) || ' days')::INTERVAL;
    ELSE RETURN p_invoice_date + INTERVAL '30 days';
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_invoice_updated_at();

DROP TRIGGER IF EXISTS update_invoice_items_updated_at ON invoice_items;
CREATE TRIGGER update_invoice_items_updated_at
  BEFORE UPDATE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION update_invoice_updated_at();

-- Function to recalculate invoice totals
CREATE OR REPLACE FUNCTION recalculate_invoice_totals(p_invoice_id UUID)
RETURNS VOID AS $$
DECLARE
  v_subtotal DECIMAL(12, 2);
  v_discount_type VARCHAR(20);
  v_discount_value DECIMAL(12, 2);
  v_discount_amount DECIMAL(12, 2);
  v_tax_rate DECIMAL(5, 2);
  v_taxable_amount DECIMAL(12, 2);
  v_tax_amount DECIMAL(12, 2);
  v_total DECIMAL(12, 2);
BEGIN
  -- Calculate subtotal from items
  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
  FROM invoice_items WHERE invoice_id = p_invoice_id;

  -- Get invoice discount settings
  SELECT discount_type, discount_value, tax_rate
  INTO v_discount_type, v_discount_value, v_tax_rate
  FROM invoices WHERE id = p_invoice_id;

  -- Calculate discount
  IF v_discount_type = 'percentage' THEN
    v_discount_amount := v_subtotal * (v_discount_value / 100);
  ELSE
    v_discount_amount := COALESCE(v_discount_value, 0);
  END IF;

  -- Calculate taxable amount (only for taxable items)
  SELECT COALESCE(SUM(line_total), 0) INTO v_taxable_amount
  FROM invoice_items WHERE invoice_id = p_invoice_id AND is_taxable = true;

  -- Adjust taxable amount for discount proportion
  IF v_subtotal > 0 THEN
    v_taxable_amount := v_taxable_amount - (v_discount_amount * (v_taxable_amount / v_subtotal));
  END IF;

  -- Calculate tax
  v_tax_amount := v_taxable_amount * (v_tax_rate / 100);

  -- Calculate total
  v_total := v_subtotal - v_discount_amount + v_tax_amount;

  -- Update invoice
  UPDATE invoices
  SET subtotal = v_subtotal,
      discount_amount = v_discount_amount,
      tax_amount = v_tax_amount,
      total = v_total
  WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate totals when items change
CREATE OR REPLACE FUNCTION trigger_recalculate_invoice_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_invoice_totals(OLD.invoice_id);
    RETURN OLD;
  ELSE
    PERFORM recalculate_invoice_totals(NEW.invoice_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recalc_invoice_totals_on_item_change ON invoice_items;
CREATE TRIGGER recalc_invoice_totals_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_invoice_totals();

-- Function to update invoice status based on payments
CREATE OR REPLACE FUNCTION update_invoice_payment_status()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid DECIMAL(12, 2);
  v_invoice_total DECIMAL(12, 2);
  v_invoice_status VARCHAR(50);
BEGIN
  -- Get total paid for this invoice
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM invoice_payments WHERE invoice_id = NEW.invoice_id;

  -- Get invoice total and current status
  SELECT total, status INTO v_invoice_total, v_invoice_status
  FROM invoices WHERE id = NEW.invoice_id;

  -- Update invoice
  UPDATE invoices
  SET amount_paid = v_total_paid,
      last_payment_date = CASE WHEN NEW.amount > 0 THEN NEW.payment_date ELSE last_payment_date END,
      status = CASE
        WHEN v_total_paid >= v_invoice_total THEN 'paid'
        WHEN v_total_paid > 0 THEN 'partially_paid'
        ELSE v_invoice_status
      END,
      paid_at = CASE WHEN v_total_paid >= v_invoice_total THEN CURRENT_TIMESTAMP ELSE paid_at END
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_payment_status ON invoice_payments;
CREATE TRIGGER update_payment_status
  AFTER INSERT ON invoice_payments
  FOR EACH ROW EXECUTE FUNCTION update_invoice_payment_status();

-- Function to check and update overdue invoices (run by cron)
CREATE OR REPLACE FUNCTION update_overdue_invoices()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE invoices
  SET status = 'overdue'
  WHERE status IN ('sent', 'viewed', 'partially_paid')
    AND due_date < CURRENT_DATE
    AND amount_paid < total;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
