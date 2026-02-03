-- ============================================================
-- Multi-Location Warehouse Support & Inventory Analytics
-- ============================================================
-- This migration adds support for tracking inventory across
-- multiple warehouse locations and implements ABC analysis
-- with dead stock identification.
--
-- Features:
-- 1. Multi-location inventory tracking
-- 2. Stock transfers between locations
-- 3. ABC classification (A/B/C items by value & usage)
-- 4. Dead stock identification (180+ days no movement)
-- ============================================================

-- ============================================================
-- STEP 1: Create Locations Table
-- ============================================================

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_user_location_name UNIQUE(user_id, name)
);

CREATE INDEX idx_locations_user_id ON locations(user_id);
CREATE INDEX idx_locations_default ON locations(is_default) WHERE is_default = true;

COMMENT ON TABLE locations IS 'Warehouse locations for inventory tracking';
COMMENT ON COLUMN locations.is_default IS 'Default location for new inventory items';

-- ============================================================
-- STEP 2: Create Location Stock Table
-- ============================================================

CREATE TABLE IF NOT EXISTS location_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_item_location UNIQUE(item_id, location_id)
);

CREATE INDEX idx_location_stock_user_id ON location_stock(user_id);
CREATE INDEX idx_location_stock_item ON location_stock(item_id);
CREATE INDEX idx_location_stock_location ON location_stock(location_id);

COMMENT ON TABLE location_stock IS 'Inventory quantity breakdown by location';
COMMENT ON CONSTRAINT unique_item_location ON location_stock IS 'Each item can only have one entry per location';

-- ============================================================
-- STEP 3: Modify Stock Movements Table
-- ============================================================

-- Add location columns to track where movements occur
ALTER TABLE stock_movements
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS destination_location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- Drop existing constraint and recreate with Transfer type
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_type_check') THEN
    ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_type_check;
  END IF;
END $$;

ALTER TABLE stock_movements
ADD CONSTRAINT stock_movements_type_check
CHECK (type IN ('In', 'Out', 'Adjustment', 'Allocation', 'Transfer'));

CREATE INDEX IF NOT EXISTS idx_movements_location ON stock_movements(location_id);
CREATE INDEX IF NOT EXISTS idx_movements_dest_location ON stock_movements(destination_location_id);

COMMENT ON COLUMN stock_movements.location_id IS 'Source location for movement or Transfer';
COMMENT ON COLUMN stock_movements.destination_location_id IS 'Destination location for Transfer movements';

-- ============================================================
-- STEP 4: Add Analytics Fields to Inventory Items
-- ============================================================

-- ABC Classification and Dead Stock tracking
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS abc_classification VARCHAR(1) CHECK (abc_classification IN ('A', 'B', 'C')),
ADD COLUMN IF NOT EXISTS last_movement_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_dead_stock BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS total_value_score DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS usage_frequency_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS allocation_rate_score DECIMAL(5, 2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_inventory_abc ON inventory_items(abc_classification);
CREATE INDEX IF NOT EXISTS idx_inventory_dead_stock ON inventory_items(is_dead_stock) WHERE is_dead_stock = true;
CREATE INDEX IF NOT EXISTS idx_inventory_last_movement ON inventory_items(last_movement_date);

COMMENT ON COLUMN inventory_items.abc_classification IS 'A (high value/usage), B (medium), C (low)';
COMMENT ON COLUMN inventory_items.last_movement_date IS 'Date of most recent stock movement';
COMMENT ON COLUMN inventory_items.is_dead_stock IS 'Flagged if no movement in 180+ days';
COMMENT ON COLUMN inventory_items.total_value_score IS 'Calculated: SUM(quantity) * price';
COMMENT ON COLUMN inventory_items.usage_frequency_score IS 'Count of Out/Allocation movements (90 days)';
COMMENT ON COLUMN inventory_items.allocation_rate_score IS 'Percentage of movements that are allocations';

-- ============================================================
-- STEP 5: Create Database Functions
-- ============================================================

-- Function to auto-update inventory_items.quantity from location_stock
CREATE OR REPLACE FUNCTION update_inventory_total_quantity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory_items
  SET
    quantity = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM location_stock
      WHERE item_id = COALESCE(NEW.item_id, OLD.item_id)
    ),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = COALESCE(NEW.item_id, OLD.item_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_inventory_total_quantity() IS 'Auto-update inventory quantity when location_stock changes';

-- Function to auto-update last_movement_date from stock_movements
CREATE OR REPLACE FUNCTION update_last_movement_date()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory_items
  SET
    last_movement_date = to_timestamp(NEW.timestamp / 1000),
    updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_last_movement_date() IS 'Auto-update last movement date when stock movement is recorded';

-- Function to calculate ABC classification
CREATE OR REPLACE FUNCTION calculate_abc_classification()
RETURNS void AS $$
DECLARE
  total_items INTEGER;
  cutoff_a INTEGER;
  cutoff_b INTEGER;
BEGIN
  -- Calculate scores for all items
  UPDATE inventory_items i
  SET
    -- Total value score: quantity * sell price
    total_value_score = COALESCE(
      (SELECT SUM(ls.quantity) FROM location_stock ls WHERE ls.item_id = i.id)
      * COALESCE(i.sell_price_excl_gst, i.price, 0),
      0
    ),
    -- Usage frequency: count of Out/Allocation movements in last 90 days
    usage_frequency_score = (
      SELECT COUNT(*)
      FROM stock_movements sm
      WHERE sm.item_id = i.id
      AND sm.type IN ('Out', 'Allocation')
      AND sm.timestamp >= EXTRACT(EPOCH FROM NOW() - INTERVAL '90 days') * 1000
    ),
    -- Allocation rate: percentage of movements that are allocations
    allocation_rate_score = CASE
      WHEN (SELECT COUNT(*) FROM stock_movements WHERE item_id = i.id) > 0
      THEN (
        SELECT COUNT(*) * 100.0 / (SELECT COUNT(*) FROM stock_movements WHERE item_id = i.id)
        FROM stock_movements
        WHERE item_id = i.id AND type = 'Allocation'
      )
      ELSE 0
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE i.user_id IS NOT NULL;

  -- Calculate composite score and rank items
  WITH ranked_items AS (
    SELECT
      id,
      user_id,
      (total_value_score * 0.5) + (usage_frequency_score * 0.3) + (allocation_rate_score * 0.2) as composite_score,
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY (total_value_score * 0.5) + (usage_frequency_score * 0.3) + (allocation_rate_score * 0.2) DESC) as rank,
      COUNT(*) OVER (PARTITION BY user_id) as total_items_per_user
    FROM inventory_items
  )
  UPDATE inventory_items i
  SET
    abc_classification = CASE
      WHEN r.rank <= (r.total_items_per_user * 0.2) THEN 'A'  -- Top 20%
      WHEN r.rank <= (r.total_items_per_user * 0.5) THEN 'B'  -- Next 30%
      ELSE 'C'  -- Bottom 50%
    END,
    updated_at = CURRENT_TIMESTAMP
  FROM ranked_items r
  WHERE i.id = r.id;

  -- Update dead stock flag (no movement in 180+ days)
  UPDATE inventory_items
  SET
    is_dead_stock = CASE
      WHEN quantity > 0 AND (
        last_movement_date IS NULL
        OR last_movement_date < NOW() - INTERVAL '180 days'
      ) THEN true
      ELSE false
    END,
    updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_abc_classification() IS 'Calculate ABC classification and dead stock for all items';

-- ============================================================
-- STEP 6: Create Triggers
-- ============================================================

-- Trigger to update inventory quantity when location_stock changes
DROP TRIGGER IF EXISTS trigger_update_inventory_quantity ON location_stock;
CREATE TRIGGER trigger_update_inventory_quantity
AFTER INSERT OR UPDATE OR DELETE ON location_stock
FOR EACH ROW
EXECUTE FUNCTION update_inventory_total_quantity();

-- Trigger to update last_movement_date when stock movement is recorded
DROP TRIGGER IF EXISTS trigger_update_last_movement ON stock_movements;
CREATE TRIGGER trigger_update_last_movement
AFTER INSERT ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION update_last_movement_date();

-- ============================================================
-- STEP 7: Data Migration
-- ============================================================

-- Insert default locations for all existing users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM users LOOP
    -- Insert Main Warehouse (default)
    INSERT INTO locations (user_id, name, is_default)
    VALUES (user_record.id, 'Main Warehouse', true)
    ON CONFLICT (user_id, name) DO NOTHING;

    -- Insert Plumbing Warehouse
    INSERT INTO locations (user_id, name, is_default)
    VALUES (user_record.id, 'Plumbing Warehouse', false)
    ON CONFLICT (user_id, name) DO NOTHING;
  END LOOP;
END $$;

-- Migrate existing inventory quantities to location_stock (Main Warehouse)
INSERT INTO location_stock (user_id, item_id, location_id, quantity)
SELECT
  i.user_id,
  i.id,
  l.id,
  i.quantity
FROM inventory_items i
INNER JOIN locations l ON l.user_id = i.user_id AND l.is_default = true
WHERE i.quantity > 0
ON CONFLICT (item_id, location_id) DO UPDATE SET quantity = EXCLUDED.quantity;

-- Set initial last_movement_date based on most recent stock movement
UPDATE inventory_items i
SET last_movement_date = (
  SELECT to_timestamp(MAX(sm.timestamp) / 1000)
  FROM stock_movements sm
  WHERE sm.item_id = i.id
)
WHERE EXISTS (
  SELECT 1 FROM stock_movements sm WHERE sm.item_id = i.id
);

-- Run initial ABC classification
SELECT calculate_abc_classification();

-- ============================================================
-- STEP 8: Grant Permissions (if needed)
-- ============================================================

-- Grant access to new tables (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON locations TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON location_stock TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- ============================================================
-- Migration Complete
-- ============================================================

-- Verification queries (uncomment to run)
-- SELECT COUNT(*) as location_count FROM locations;
-- SELECT COUNT(*) as location_stock_count FROM location_stock;
-- SELECT abc_classification, COUNT(*) FROM inventory_items GROUP BY abc_classification;
-- SELECT COUNT(*) as dead_stock_count FROM inventory_items WHERE is_dead_stock = true;
