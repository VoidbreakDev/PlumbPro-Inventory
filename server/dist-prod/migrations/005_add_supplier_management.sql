-- ============================================================================
-- Migration 005: Supplier Management Enhancements
-- ============================================================================
-- Description: Add comprehensive supplier management features including
--              multiple suppliers per item, ratings, delivery tracking,
--              contract pricing, and price change alerts.
--
-- Author: Claude Sonnet 4.5
-- Date: 2026-01-12
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Enhance Existing Tables
-- ============================================================================

-- Add supplier-related fields to contacts table
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS website VARCHAR(500),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS abn VARCHAR(20),
  ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(100),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3, 2),
  ADD COLUMN IF NOT EXISTS total_ratings INTEGER DEFAULT 0;

-- Add delivery tracking fields to purchase_orders table
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(200),
  ADD COLUMN IF NOT EXISTS carrier VARCHAR(100),
  ADD COLUMN IF NOT EXISTS actual_delivery_date DATE;

-- Add supplier statistics to inventory_items table
ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS lowest_price_supplier_id UUID REFERENCES contacts(id),
  ADD COLUMN IF NOT EXISTS lowest_unit_price DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS supplier_count INTEGER DEFAULT 0;

-- ============================================================================
-- 2. Create New Tables
-- ============================================================================

-- Table: item_suppliers
-- Purpose: Many-to-many relationship between items and suppliers with pricing
CREATE TABLE IF NOT EXISTS item_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Pricing Information
  supplier_code VARCHAR(100),
  unit_price_excl_gst DECIMAL(10, 2) NOT NULL CHECK (unit_price_excl_gst >= 0),
  unit_price_incl_gst DECIMAL(10, 2) NOT NULL CHECK (unit_price_incl_gst >= 0),
  currency VARCHAR(3) DEFAULT 'AUD',

  -- Lead Time and Availability
  lead_time_days INTEGER CHECK (lead_time_days >= 0),
  minimum_order_quantity INTEGER DEFAULT 1 CHECK (minimum_order_quantity >= 1),
  is_preferred BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Contract Information
  has_contract BOOLEAN DEFAULT false,
  contract_price DECIMAL(10, 2) CHECK (contract_price IS NULL OR contract_price >= 0),
  contract_start_date DATE,
  contract_end_date DATE,
  contract_notes TEXT,

  -- Tracking
  last_ordered_date TIMESTAMP,
  last_price_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  times_ordered INTEGER DEFAULT 0 CHECK (times_ordered >= 0),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_item_supplier UNIQUE (item_id, supplier_id),
  CONSTRAINT valid_contract_dates CHECK (
    (has_contract = false) OR
    (contract_start_date IS NOT NULL AND contract_end_date IS NOT NULL AND contract_end_date >= contract_start_date)
  )
);

CREATE INDEX IF NOT EXISTS idx_item_suppliers_item ON item_suppliers(item_id);
CREATE INDEX IF NOT EXISTS idx_item_suppliers_supplier ON item_suppliers(supplier_id);
CREATE INDEX IF NOT EXISTS idx_item_suppliers_user ON item_suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_item_suppliers_preferred ON item_suppliers(item_id, is_preferred) WHERE is_preferred = true;
CREATE INDEX IF NOT EXISTS idx_item_suppliers_active ON item_suppliers(is_active) WHERE is_active = true;

-- Table: supplier_ratings
-- Purpose: Track supplier performance ratings and reviews
CREATE TABLE IF NOT EXISTS supplier_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,

  -- Rating Fields (1-5 stars)
  overall_rating INTEGER NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  pricing_rating INTEGER CHECK (pricing_rating >= 1 AND pricing_rating <= 5),

  -- Review
  review_title VARCHAR(200),
  review_text TEXT,
  would_recommend BOOLEAN,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_po_rating UNIQUE (purchase_order_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_ratings_supplier ON supplier_ratings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_ratings_user ON supplier_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_ratings_created ON supplier_ratings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_ratings_overall ON supplier_ratings(overall_rating DESC);

-- Table: supplier_delivery_tracking
-- Purpose: Track actual delivery performance vs expected dates
CREATE TABLE IF NOT EXISTS supplier_delivery_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,

  -- Dates
  expected_delivery_date DATE NOT NULL,
  actual_delivery_date DATE,
  days_early_late INTEGER,

  -- Delivery Status
  delivery_status VARCHAR(50) DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'on_time', 'late', 'early')),
  tracking_number VARCHAR(200),
  carrier VARCHAR(100),

  -- Issues
  had_issues BOOLEAN DEFAULT false,
  issue_description TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_supplier ON supplier_delivery_tracking(supplier_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_po ON supplier_delivery_tracking(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_user ON supplier_delivery_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_status ON supplier_delivery_tracking(delivery_status);

-- Table: price_change_alerts
-- Purpose: Track price changes and alert users
CREATE TABLE IF NOT EXISTS price_change_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Price Change
  old_price_excl_gst DECIMAL(10, 2) NOT NULL,
  new_price_excl_gst DECIMAL(10, 2) NOT NULL,
  price_difference DECIMAL(10, 2) NOT NULL,
  percentage_change DECIMAL(5, 2) NOT NULL,

  -- Alert Status
  is_viewed BOOLEAN DEFAULT false,
  is_acknowledged BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON price_change_alerts(user_id, is_viewed);
CREATE INDEX IF NOT EXISTS idx_price_alerts_item ON price_change_alerts(item_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_supplier ON price_change_alerts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_created ON price_change_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_alerts_unviewed ON price_change_alerts(user_id) WHERE is_viewed = false;

-- ============================================================================
-- 3. Database Functions
-- ============================================================================

-- Function: update_supplier_average_rating
-- Purpose: Automatically update supplier average rating when ratings change
CREATE OR REPLACE FUNCTION update_supplier_average_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE contacts
  SET
    average_rating = (
      SELECT AVG(overall_rating)::DECIMAL(3,2)
      FROM supplier_ratings
      WHERE supplier_id = COALESCE(NEW.supplier_id, OLD.supplier_id)
    ),
    total_ratings = (
      SELECT COUNT(*)
      FROM supplier_ratings
      WHERE supplier_id = COALESCE(NEW.supplier_id, OLD.supplier_id)
    )
  WHERE id = COALESCE(NEW.supplier_id, OLD.supplier_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function: update_item_supplier_stats
-- Purpose: Auto-update inventory item supplier count and lowest price
CREATE OR REPLACE FUNCTION update_item_supplier_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory_items
  SET
    supplier_count = (
      SELECT COUNT(*)
      FROM item_suppliers
      WHERE item_id = COALESCE(NEW.item_id, OLD.item_id)
        AND is_active = true
    ),
    lowest_unit_price = (
      SELECT MIN(unit_price_excl_gst)
      FROM item_suppliers
      WHERE item_id = COALESCE(NEW.item_id, OLD.item_id)
        AND is_active = true
    ),
    lowest_price_supplier_id = (
      SELECT supplier_id
      FROM item_suppliers
      WHERE item_id = COALESCE(NEW.item_id, OLD.item_id)
        AND is_active = true
      ORDER BY unit_price_excl_gst ASC
      LIMIT 1
    ),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = COALESCE(NEW.item_id, OLD.item_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function: create_price_change_alert
-- Purpose: Create alert when supplier price changes
CREATE OR REPLACE FUNCTION create_price_change_alert()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if price changed and not initial insert
  IF TG_OP = 'UPDATE' AND OLD.unit_price_excl_gst != NEW.unit_price_excl_gst THEN
    INSERT INTO price_change_alerts (
      user_id,
      item_id,
      supplier_id,
      old_price_excl_gst,
      new_price_excl_gst,
      price_difference,
      percentage_change
    )
    VALUES (
      NEW.user_id,
      NEW.item_id,
      NEW.supplier_id,
      OLD.unit_price_excl_gst,
      NEW.unit_price_excl_gst,
      NEW.unit_price_excl_gst - OLD.unit_price_excl_gst,
      ((NEW.unit_price_excl_gst - OLD.unit_price_excl_gst) / NULLIF(OLD.unit_price_excl_gst, 0) * 100)::DECIMAL(5,2)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: calculate_delivery_performance
-- Purpose: Auto-calculate delivery status and days early/late
CREATE OR REPLACE FUNCTION calculate_delivery_performance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.actual_delivery_date IS NOT NULL AND NEW.expected_delivery_date IS NOT NULL THEN
    NEW.days_early_late = NEW.actual_delivery_date - NEW.expected_delivery_date;

    NEW.delivery_status = CASE
      WHEN NEW.days_early_late = 0 THEN 'on_time'
      WHEN NEW.days_early_late < 0 THEN 'early'
      ELSE 'late'
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: update_item_supplier_timestamps
-- Purpose: Update timestamps on item_suppliers modifications
CREATE OR REPLACE FUNCTION update_item_supplier_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;

  -- Update last_price_update if price changed
  IF TG_OP = 'UPDATE' AND (
    OLD.unit_price_excl_gst != NEW.unit_price_excl_gst OR
    OLD.unit_price_incl_gst != NEW.unit_price_incl_gst
  ) THEN
    NEW.last_price_update = CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. Create Triggers
-- ============================================================================

-- Trigger: Auto-update supplier average rating
DROP TRIGGER IF EXISTS trigger_update_supplier_rating ON supplier_ratings;
CREATE TRIGGER trigger_update_supplier_rating
AFTER INSERT OR UPDATE OR DELETE ON supplier_ratings
FOR EACH ROW
EXECUTE FUNCTION update_supplier_average_rating();

-- Trigger: Auto-update item supplier statistics
DROP TRIGGER IF EXISTS trigger_update_item_supplier_stats ON item_suppliers;
CREATE TRIGGER trigger_update_item_supplier_stats
AFTER INSERT OR UPDATE OR DELETE ON item_suppliers
FOR EACH ROW
EXECUTE FUNCTION update_item_supplier_stats();

-- Trigger: Create price change alert on price update
DROP TRIGGER IF EXISTS trigger_create_price_alert ON item_suppliers;
CREATE TRIGGER trigger_create_price_alert
AFTER UPDATE ON item_suppliers
FOR EACH ROW
EXECUTE FUNCTION create_price_change_alert();

-- Trigger: Calculate delivery performance automatically
DROP TRIGGER IF EXISTS trigger_calculate_delivery_performance ON supplier_delivery_tracking;
CREATE TRIGGER trigger_calculate_delivery_performance
BEFORE INSERT OR UPDATE ON supplier_delivery_tracking
FOR EACH ROW
EXECUTE FUNCTION calculate_delivery_performance();

-- Trigger: Update item_suppliers timestamps
DROP TRIGGER IF EXISTS trigger_update_item_supplier_timestamps ON item_suppliers;
CREATE TRIGGER trigger_update_item_supplier_timestamps
BEFORE UPDATE ON item_suppliers
FOR EACH ROW
EXECUTE FUNCTION update_item_supplier_timestamps();

-- ============================================================================
-- 5. Data Migration
-- ============================================================================

-- Migrate existing inventory items to item_suppliers table
-- For each item with a supplier, create an entry in item_suppliers
INSERT INTO item_suppliers (
  user_id,
  item_id,
  supplier_id,
  supplier_code,
  unit_price_excl_gst,
  unit_price_incl_gst,
  is_preferred,
  is_active,
  last_ordered_date,
  created_at,
  updated_at
)
SELECT
  i.user_id,
  i.id,
  i.supplier_id,
  i.supplier_code,
  COALESCE(i.buy_price_excl_gst, i.price, 0),  -- Use buy price or legacy price
  COALESCE(i.buy_price_incl_gst, i.price * 1.1, 0),  -- Calculate GST if needed
  true,  -- Mark as preferred (was the primary supplier)
  true,  -- Active
  i.last_movement_date,
  i.created_at,
  i.updated_at
FROM inventory_items i
WHERE i.supplier_id IS NOT NULL
ON CONFLICT (item_id, supplier_id) DO NOTHING;

-- Update supplier_count for all items
UPDATE inventory_items
SET supplier_count = (
  SELECT COUNT(*)
  FROM item_suppliers
  WHERE item_id = inventory_items.id
    AND is_active = true
)
WHERE EXISTS (
  SELECT 1
  FROM item_suppliers
  WHERE item_id = inventory_items.id
);

-- Update lowest_unit_price and lowest_price_supplier_id for all items
UPDATE inventory_items i
SET
  lowest_unit_price = subquery.min_price,
  lowest_price_supplier_id = subquery.supplier_id
FROM (
  SELECT
    item_id,
    MIN(unit_price_excl_gst) as min_price,
    (
      SELECT supplier_id
      FROM item_suppliers is2
      WHERE is2.item_id = is1.item_id
        AND is2.is_active = true
      ORDER BY is2.unit_price_excl_gst ASC
      LIMIT 1
    ) as supplier_id
  FROM item_suppliers is1
  WHERE is_active = true
  GROUP BY item_id
) subquery
WHERE i.id = subquery.item_id;

-- ============================================================================
-- 6. Grant Permissions (if using role-based access)
-- ============================================================================

-- Grant access to new tables (adjust role names as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON item_suppliers TO authenticated_users;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_ratings TO authenticated_users;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_delivery_tracking TO authenticated_users;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON price_change_alerts TO authenticated_users;

-- ============================================================================
-- Migration Complete
-- ============================================================================

COMMIT;

-- Verification queries (run these manually after migration)
-- SELECT COUNT(*) FROM item_suppliers;
-- SELECT COUNT(*) FROM supplier_ratings;
-- SELECT COUNT(*) FROM supplier_delivery_tracking;
-- SELECT COUNT(*) FROM price_change_alerts;
-- SELECT id, name, supplier_count, lowest_unit_price FROM inventory_items WHERE supplier_count > 0 LIMIT 10;
