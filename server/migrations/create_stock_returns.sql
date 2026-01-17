-- Stock Return System Migration
-- Tracks stock that is returned from jobs to warehouse

-- Main stock returns table
CREATE TABLE IF NOT EXISTS stock_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  -- Return details
  returned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  returned_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- pending, confirmed, cancelled

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock return line items
CREATE TABLE IF NOT EXISTS stock_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_return_id UUID NOT NULL REFERENCES stock_returns(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,

  -- Quantities
  quantity_allocated INTEGER NOT NULL, -- What was originally picked for the job
  quantity_returned INTEGER NOT NULL, -- What came back
  quantity_used INTEGER GENERATED ALWAYS AS (quantity_allocated - quantity_returned) STORED,

  -- Condition tracking
  condition VARCHAR(50) DEFAULT 'good',
  -- good, damaged, lost

  -- Notes for specific items
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT positive_allocated CHECK (quantity_allocated >= 0),
  CONSTRAINT positive_returned CHECK (quantity_returned >= 0),
  CONSTRAINT returned_not_exceed_allocated CHECK (quantity_returned <= quantity_allocated)
);

-- Track damage/loss separately for reporting
CREATE TABLE IF NOT EXISTS stock_return_discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_return_item_id UUID NOT NULL REFERENCES stock_return_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Discrepancy details
  discrepancy_type VARCHAR(50) NOT NULL,
  -- damaged, lost, broken, other

  quantity INTEGER NOT NULL,
  reason TEXT,
  cost_impact DECIMAL(10, 2),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT positive_discrepancy_quantity CHECK (quantity > 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_returns_user ON stock_returns(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_returns_job ON stock_returns(job_id);
CREATE INDEX IF NOT EXISTS idx_stock_returns_status ON stock_returns(status);
CREATE INDEX IF NOT EXISTS idx_stock_returns_date ON stock_returns(returned_at);

CREATE INDEX IF NOT EXISTS idx_stock_return_items_return ON stock_return_items(stock_return_id);
CREATE INDEX IF NOT EXISTS idx_stock_return_items_inventory ON stock_return_items(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_return_items_condition ON stock_return_items(condition);

CREATE INDEX IF NOT EXISTS idx_stock_return_discrepancies_item ON stock_return_discrepancies(stock_return_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_return_discrepancies_type ON stock_return_discrepancies(discrepancy_type);

-- Function to update inventory when return is confirmed
CREATE OR REPLACE FUNCTION process_stock_return()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes to 'confirmed'
  IF (TG_OP = 'UPDATE' AND OLD.status != 'confirmed' AND NEW.status = 'confirmed') THEN

    -- Update inventory quantities for all returned items
    UPDATE inventory_items i
    SET quantity = i.quantity + sri.quantity_returned
    FROM stock_return_items sri
    WHERE sri.stock_return_id = NEW.id
      AND sri.inventory_item_id = i.id
      AND sri.condition = 'good'; -- Only add good items back to stock

    -- Create stock movement records for audit trail
    INSERT INTO stock_movements (user_id, item_id, type, quantity, reference, notes)
    SELECT
      NEW.user_id,
      sri.inventory_item_id,
      'In',
      sri.quantity_returned,
      NEW.job_id,
      CONCAT('Returned from job (Return ID: ', NEW.id, ')')
    FROM stock_return_items sri
    WHERE sri.stock_return_id = NEW.id
      AND sri.condition = 'good';

    -- For damaged items, create separate movement records (not added to stock)
    INSERT INTO stock_movements (user_id, item_id, type, quantity, reference, notes)
    SELECT
      NEW.user_id,
      sri.inventory_item_id,
      'Adjustment',
      -sri.quantity_returned, -- Negative because they're damaged
      NEW.job_id,
      CONCAT('Damaged items from job (Return ID: ', NEW.id, ') - ', sri.notes)
    FROM stock_return_items sri
    WHERE sri.stock_return_id = NEW.id
      AND sri.condition = 'damaged';

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to process stock returns
DROP TRIGGER IF EXISTS process_stock_return_trigger ON stock_returns;
CREATE TRIGGER process_stock_return_trigger
  AFTER UPDATE ON stock_returns
  FOR EACH ROW
  EXECUTE FUNCTION process_stock_return();

-- Function to track actual usage per job
CREATE OR REPLACE FUNCTION update_job_usage_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update a metadata field on jobs table to track usage
  -- This could be used for cost tracking and reporting

  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    -- Calculate total allocated, returned, and used
    UPDATE jobs
    SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'stock_allocated', (
        SELECT COALESCE(SUM(quantity), 0)
        FROM job_allocated_items
        WHERE job_id = NEW.job_id
      ),
      'stock_returned', (
        SELECT COALESCE(SUM(sri.quantity_returned), 0)
        FROM stock_returns sr
        JOIN stock_return_items sri ON sr.id = sri.stock_return_id
        WHERE sr.job_id = NEW.job_id AND sr.status = 'confirmed'
      ),
      'stock_used', (
        SELECT COALESCE(SUM(sri.quantity_used), 0)
        FROM stock_returns sr
        JOIN stock_return_items sri ON sr.id = sri.stock_return_id
        WHERE sr.job_id = NEW.job_id AND sr.status = 'confirmed'
      ),
      'last_return_date', NEW.returned_at
    )
    WHERE id = NEW.job_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update job usage stats when returns are created/updated
DROP TRIGGER IF EXISTS update_job_usage_stats_trigger ON stock_returns;
CREATE TRIGGER update_job_usage_stats_trigger
  AFTER INSERT OR UPDATE ON stock_returns
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed')
  EXECUTE FUNCTION update_job_usage_stats();

-- Comments for documentation
COMMENT ON TABLE stock_returns IS 'Tracks stock returned from jobs to warehouse';
COMMENT ON TABLE stock_return_items IS 'Individual items returned from a job';
COMMENT ON TABLE stock_return_discrepancies IS 'Track damaged, lost, or broken items';

COMMENT ON COLUMN stock_return_items.quantity_allocated IS 'Original quantity picked for the job';
COMMENT ON COLUMN stock_return_items.quantity_returned IS 'Quantity that came back';
COMMENT ON COLUMN stock_return_items.quantity_used IS 'Calculated: allocated - returned';
COMMENT ON COLUMN stock_return_items.condition IS 'good, damaged, lost';

-- Add metadata column to jobs table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE jobs ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;
