-- Purchase Order System Migration
-- Creates tables for purchase order management with job tracking

-- Main purchase orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  po_number VARCHAR(50) UNIQUE NOT NULL, -- Auto-generated: PO-2024-001
  supplier_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  -- draft, sent, confirmed, partially_received, received, cancelled

  -- Dates
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  expected_delivery_date DATE,
  received_at TIMESTAMP,

  -- Financial
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tax DECIMAL(10, 2) DEFAULT 0,
  shipping DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,

  -- Additional info
  notes TEXT,
  internal_notes TEXT, -- Not shown on PO sent to supplier
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Metadata
  metadata JSONB, -- Store additional flexible data

  CONSTRAINT valid_total CHECK (total >= 0)
);

-- Purchase order line items
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,

  -- Item details (snapshot at time of PO creation)
  item_name VARCHAR(255) NOT NULL,
  item_description TEXT,
  supplier_code VARCHAR(100),

  -- Quantities
  quantity_ordered INTEGER NOT NULL,
  quantity_received INTEGER DEFAULT 0,

  -- Pricing
  unit_price DECIMAL(10, 2) NOT NULL,
  line_total DECIMAL(10, 2) NOT NULL,

  -- Optional job assignment
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT positive_quantity CHECK (quantity_ordered > 0),
  CONSTRAINT positive_price CHECK (unit_price >= 0),
  CONSTRAINT received_quantity_valid CHECK (quantity_received <= quantity_ordered AND quantity_received >= 0)
);

-- Link POs to jobs (many-to-many)
CREATE TABLE IF NOT EXISTS purchase_order_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(purchase_order_id, job_id)
);

-- PO status history for audit trail
CREATE TABLE IF NOT EXISTS purchase_order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Receiving records (track partial deliveries)
CREATE TABLE IF NOT EXISTS purchase_order_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,

  -- Link to stock movements
  stock_movement_id UUID REFERENCES stock_movements(id) ON DELETE SET NULL
);

-- Receipt line items
CREATE TABLE IF NOT EXISTS purchase_order_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES purchase_order_receipts(id) ON DELETE CASCADE,
  po_item_id UUID NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
  quantity_received INTEGER NOT NULL,
  notes TEXT,

  CONSTRAINT positive_received_quantity CHECK (quantity_received > 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_po_user ON purchase_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_po_created ON purchase_orders(created_at);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_items_inventory ON purchase_order_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_po_items_job ON purchase_order_items(job_id);

CREATE INDEX IF NOT EXISTS idx_po_jobs_po ON purchase_order_jobs(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_jobs_job ON purchase_order_jobs(job_id);

CREATE INDEX IF NOT EXISTS idx_po_history_po ON purchase_order_history(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_receipts_po ON purchase_order_receipts(purchase_order_id);

-- Function to generate PO number
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  year_str VARCHAR(4);
  po_num VARCHAR(50);
BEGIN
  -- Get current year
  year_str := TO_CHAR(CURRENT_DATE, 'YYYY');

  -- Get next number for this year
  SELECT COALESCE(MAX(
    CAST(
      SUBSTRING(po_number FROM 'PO-' || year_str || '-(\d+)') AS INTEGER
    )
  ), 0) + 1
  INTO next_num
  FROM purchase_orders
  WHERE po_number LIKE 'PO-' || year_str || '-%';

  -- Generate PO number: PO-2024-001
  NEW.po_number := 'PO-' || year_str || '-' || LPAD(next_num::TEXT, 3, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate PO number
DROP TRIGGER IF EXISTS generate_po_number_trigger ON purchase_orders;
CREATE TRIGGER generate_po_number_trigger
  BEFORE INSERT ON purchase_orders
  FOR EACH ROW
  WHEN (NEW.po_number IS NULL OR NEW.po_number = '')
  EXECUTE FUNCTION generate_po_number();

-- Function to update PO totals
CREATE OR REPLACE FUNCTION update_po_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE purchase_orders
  SET subtotal = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM purchase_order_items
    WHERE purchase_order_id = NEW.purchase_order_id
  ),
  total = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM purchase_order_items
    WHERE purchase_order_id = NEW.purchase_order_id
  ) + COALESCE((SELECT tax FROM purchase_orders WHERE id = NEW.purchase_order_id), 0)
    + COALESCE((SELECT shipping FROM purchase_orders WHERE id = NEW.purchase_order_id), 0)
  WHERE id = NEW.purchase_order_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate totals when items change
DROP TRIGGER IF EXISTS update_po_totals_trigger ON purchase_order_items;
CREATE TRIGGER update_po_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON purchase_order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_po_totals();

-- Function to log status changes
CREATE OR REPLACE FUNCTION log_po_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO purchase_order_history (purchase_order_id, user_id, status, notes)
    VALUES (NEW.id, NEW.user_id, NEW.status, 'Status changed from ' || OLD.status || ' to ' || NEW.status);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log status changes
DROP TRIGGER IF EXISTS log_po_status_change_trigger ON purchase_orders;
CREATE TRIGGER log_po_status_change_trigger
  AFTER UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION log_po_status_change();

-- Comments for documentation
COMMENT ON TABLE purchase_orders IS 'Main purchase orders table for tracking supplier orders';
COMMENT ON TABLE purchase_order_items IS 'Line items for each purchase order';
COMMENT ON TABLE purchase_order_jobs IS 'Links purchase orders to specific jobs';
COMMENT ON TABLE purchase_order_history IS 'Audit trail of status changes';
COMMENT ON TABLE purchase_order_receipts IS 'Tracks when POs are received (supports partial delivery)';
COMMENT ON TABLE purchase_order_receipt_items IS 'Line items for each receipt';

COMMENT ON COLUMN purchase_orders.po_number IS 'Auto-generated: PO-YYYY-NNN';
COMMENT ON COLUMN purchase_orders.status IS 'draft, sent, confirmed, partially_received, received, cancelled';
COMMENT ON COLUMN purchase_orders.internal_notes IS 'Notes for internal use only, not shown on PO';
COMMENT ON COLUMN purchase_order_items.quantity_received IS 'Tracks partial deliveries';
