-- Goods Inward Enhancement Schema
-- Extends purchase order receipts with discrepancy tracking and full integration

-- Extend receipt items table with discrepancy tracking
ALTER TABLE purchase_order_receipt_items
  ADD COLUMN IF NOT EXISTS quantity_expected INTEGER,
  ADD COLUMN IF NOT EXISTS condition VARCHAR(50) DEFAULT 'good'
    CHECK (condition IN ('good', 'damaged', 'defective', 'wrong_item', 'partial')),
  ADD COLUMN IF NOT EXISTS discrepancy_type VARCHAR(50)
    CHECK (discrepancy_type IN ('none', 'short', 'over', 'damaged', 'wrong_item', 'substitution')),
  ADD COLUMN IF NOT EXISTS discrepancy_quantity INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discrepancy_notes TEXT,
  ADD COLUMN IF NOT EXISTS unit_price_received DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS expiry_date DATE;

-- Extend receipts table with delivery info
ALTER TABLE purchase_order_receipts
  ADD COLUMN IF NOT EXISTS delivery_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS delivery_reference VARCHAR(100),
  ADD COLUMN IF NOT EXISTS carrier VARCHAR(100),
  ADD COLUMN IF NOT EXISTS packing_slip_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS has_discrepancies BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS discrepancy_resolved BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS total_received_value DECIMAL(12, 2) DEFAULT 0;

-- Create goods inward discrepancy log for tracking issues
CREATE TABLE IF NOT EXISTS goods_inward_discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES purchase_order_receipts(id) ON DELETE CASCADE,
  receipt_item_id UUID REFERENCES purchase_order_receipt_items(id) ON DELETE SET NULL,
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Discrepancy details
  discrepancy_type VARCHAR(50) NOT NULL
    CHECK (discrepancy_type IN ('short_shipment', 'over_shipment', 'damaged', 'defective',
                                 'wrong_item', 'substitution', 'quality_issue', 'price_variance', 'other')),

  -- Item info
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,

  -- Quantity discrepancy
  quantity_expected INTEGER,
  quantity_received INTEGER,
  quantity_variance INTEGER,

  -- Price discrepancy
  price_expected DECIMAL(10, 2),
  price_received DECIMAL(10, 2),
  price_variance DECIMAL(10, 2),

  -- Resolution
  status VARCHAR(50) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'pending_supplier', 'credit_requested', 'credit_received',
                      'replacement_ordered', 'replacement_received', 'written_off', 'resolved')),
  resolution_notes TEXT,
  resolution_action VARCHAR(100),
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,

  -- Financial impact
  financial_impact DECIMAL(12, 2) DEFAULT 0,
  credit_note_number VARCHAR(100),
  credit_amount DECIMAL(12, 2),

  -- Supplier response
  supplier_notified BOOLEAN DEFAULT false,
  supplier_notified_at TIMESTAMP,
  supplier_response TEXT,
  supplier_response_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for discrepancies
CREATE INDEX IF NOT EXISTS idx_gi_discrepancies_receipt ON goods_inward_discrepancies(receipt_id);
CREATE INDEX IF NOT EXISTS idx_gi_discrepancies_po ON goods_inward_discrepancies(po_id);
CREATE INDEX IF NOT EXISTS idx_gi_discrepancies_status ON goods_inward_discrepancies(status);
CREATE INDEX IF NOT EXISTS idx_gi_discrepancies_user ON goods_inward_discrepancies(user_id);

-- Quick check-in options table
CREATE TABLE IF NOT EXISTS goods_inward_quick_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES purchase_order_receipts(id) ON DELETE CASCADE,
  check_type VARCHAR(50) NOT NULL
    CHECK (check_type IN ('all_correct', 'issues_found', 'skip_for_now')),
  user_id UUID NOT NULL REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Function to calculate receipt totals and flag discrepancies
CREATE OR REPLACE FUNCTION update_receipt_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_has_discrepancies BOOLEAN;
  v_total_value DECIMAL(12, 2);
BEGIN
  -- Check if any items have discrepancies
  SELECT EXISTS(
    SELECT 1 FROM purchase_order_receipt_items
    WHERE receipt_id = COALESCE(NEW.receipt_id, OLD.receipt_id)
    AND discrepancy_type IS NOT NULL AND discrepancy_type != 'none'
  ) INTO v_has_discrepancies;

  -- Calculate total received value
  SELECT COALESCE(SUM(quantity_received * COALESCE(unit_price_received,
    (SELECT unit_price FROM purchase_order_items WHERE id = po_item_id)
  )), 0)
  INTO v_total_value
  FROM purchase_order_receipt_items
  WHERE receipt_id = COALESCE(NEW.receipt_id, OLD.receipt_id);

  -- Update receipt
  UPDATE purchase_order_receipts
  SET has_discrepancies = v_has_discrepancies,
      discrepancy_resolved = NOT v_has_discrepancies,
      total_received_value = v_total_value
  WHERE id = COALESCE(NEW.receipt_id, OLD.receipt_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for receipt updates
DROP TRIGGER IF EXISTS update_receipt_totals_trigger ON purchase_order_receipt_items;
CREATE TRIGGER update_receipt_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON purchase_order_receipt_items
  FOR EACH ROW
  EXECUTE FUNCTION update_receipt_totals();

-- Function to create stock movement on receipt
CREATE OR REPLACE FUNCTION create_receipt_stock_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_item_id UUID;
  v_po_id UUID;
  v_user_id UUID;
  v_item_name VARCHAR(255);
  v_po_number VARCHAR(50);
BEGIN
  -- Only process if quantity received > 0 and linked to inventory item
  IF NEW.quantity_received > 0 THEN
    -- Get the inventory item ID from PO item
    SELECT poi.inventory_item_id, po.id, po.user_id, poi.item_name, po.po_number
    INTO v_item_id, v_po_id, v_user_id, v_item_name, v_po_number
    FROM purchase_order_items poi
    JOIN purchase_orders po ON po.id = poi.purchase_order_id
    WHERE poi.id = NEW.po_item_id;

    -- Only create movement if linked to inventory
    IF v_item_id IS NOT NULL THEN
      -- Create stock movement
      INSERT INTO stock_movements (
        user_id,
        item_id,
        type,
        quantity,
        reference,
        timestamp
      ) VALUES (
        v_user_id,
        v_item_id,
        'In',
        NEW.quantity_received,
        'GI from PO ' || v_po_number || ' - ' || v_item_name,
        EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000
      );

      -- Update inventory quantity
      UPDATE inventory_items
      SET quantity = quantity + NEW.quantity_received
      WHERE id = v_item_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create stock movement on receipt
DROP TRIGGER IF EXISTS create_receipt_stock_movement_trigger ON purchase_order_receipt_items;
CREATE TRIGGER create_receipt_stock_movement_trigger
  AFTER INSERT ON purchase_order_receipt_items
  FOR EACH ROW
  EXECUTE FUNCTION create_receipt_stock_movement();

-- Comments
COMMENT ON TABLE goods_inward_discrepancies IS 'Tracks discrepancies found during goods inward process';
COMMENT ON TABLE goods_inward_quick_checks IS 'Quick check-in options for simple receipts';
