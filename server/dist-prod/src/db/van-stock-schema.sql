-- Van Stock Management Schema
-- Mobile-optimized service van inventory tracking

-- Service vans/vehicles
CREATE TABLE IF NOT EXISTS service_vans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Van details
  name VARCHAR(255) NOT NULL,
  registration VARCHAR(50),
  make VARCHAR(100),
  model VARCHAR(100),
  year INTEGER,
  color VARCHAR(50),

  -- Assigned technician
  assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_name VARCHAR(255),

  -- Status
  is_active BOOLEAN DEFAULT true,
  status VARCHAR(50) DEFAULT 'available'
    CHECK (status IN ('available', 'in_use', 'maintenance', 'out_of_service')),

  -- Location (for GPS tracking)
  last_known_lat DECIMAL(10, 8),
  last_known_lng DECIMAL(11, 8),
  last_location_update TIMESTAMP,

  -- Capacity
  max_weight_kg DECIMAL(10, 2),
  max_volume_m3 DECIMAL(10, 2),

  -- Notes
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, name)
);

-- Van stock levels (what's currently in each van)
CREATE TABLE IF NOT EXISTS van_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  van_id UUID NOT NULL REFERENCES service_vans(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,

  -- Stock levels
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER DEFAULT 0,  -- Alert threshold
  max_quantity INTEGER,  -- Maximum to carry

  -- Last restocked
  last_restocked_at TIMESTAMP,
  restocked_by_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Location in van
  bin_location VARCHAR(100),  -- e.g., "Shelf A2", "Tool Drawer 1"

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(van_id, item_id)
);

-- Van stock movements (transfers to/from vans)
CREATE TABLE IF NOT EXISTS van_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  van_id UUID NOT NULL REFERENCES service_vans(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,

  -- Movement type
  movement_type VARCHAR(50) NOT NULL
    CHECK (movement_type IN (
      'restock',         -- Adding stock to van from warehouse
      'return',          -- Returning stock from van to warehouse
      'job_usage',       -- Used on a job
      'transfer_in',     -- Transferred from another van
      'transfer_out',    -- Transferred to another van
      'adjustment',      -- Manual adjustment
      'damaged',         -- Written off as damaged
      'lost'             -- Lost/missing
    )),

  -- Quantities
  quantity INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,

  -- Related entities
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  source_van_id UUID REFERENCES service_vans(id) ON DELETE SET NULL,
  destination_van_id UUID REFERENCES service_vans(id) ON DELETE SET NULL,
  source_location_id UUID,  -- Warehouse location if restocking

  -- Who and when
  performed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  performed_by_name VARCHAR(255),
  notes TEXT,

  -- GPS location at time of movement
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Van restock requests
CREATE TABLE IF NOT EXISTS van_restock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  van_id UUID NOT NULL REFERENCES service_vans(id) ON DELETE CASCADE,

  -- Request details
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'processing', 'ready', 'completed', 'cancelled')),

  requested_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_by_name VARCHAR(255),
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Processing
  approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  processed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  processed_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Pickup details
  pickup_location VARCHAR(255),
  pickup_time TIMESTAMP,
  pickup_notes TEXT,

  -- Priority
  priority VARCHAR(20) DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Items in a restock request
CREATE TABLE IF NOT EXISTS van_restock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES van_restock_requests(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,

  -- Quantities
  quantity_requested INTEGER NOT NULL,
  quantity_approved INTEGER,
  quantity_fulfilled INTEGER,

  -- Notes for this specific item
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(request_id, item_id)
);

-- Van stock check-ins (periodic stock counts)
CREATE TABLE IF NOT EXISTS van_stock_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  van_id UUID NOT NULL REFERENCES service_vans(id) ON DELETE CASCADE,

  -- Check-in details
  checkin_type VARCHAR(50) NOT NULL DEFAULT 'daily'
    CHECK (checkin_type IN ('daily', 'weekly', 'monthly', 'ad_hoc')),

  performed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  performed_by_name VARCHAR(255),

  -- Results
  total_items_checked INTEGER DEFAULT 0,
  discrepancies_found INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'discrepancies_pending')),

  -- GPS location
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),

  notes TEXT,

  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Individual items in a stock check-in
CREATE TABLE IF NOT EXISTS van_stock_checkin_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id UUID NOT NULL REFERENCES van_stock_checkins(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,

  -- Quantities
  expected_quantity INTEGER NOT NULL,
  counted_quantity INTEGER,
  discrepancy INTEGER GENERATED ALWAYS AS (counted_quantity - expected_quantity) STORED,

  -- If there's a discrepancy
  discrepancy_reason TEXT,
  discrepancy_resolved BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(checkin_id, item_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_service_vans_user ON service_vans(user_id);
CREATE INDEX IF NOT EXISTS idx_service_vans_assigned ON service_vans(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_service_vans_status ON service_vans(user_id, status);

CREATE INDEX IF NOT EXISTS idx_van_stock_van ON van_stock(van_id);
CREATE INDEX IF NOT EXISTS idx_van_stock_item ON van_stock(item_id);
CREATE INDEX IF NOT EXISTS idx_van_stock_low ON van_stock(van_id) WHERE quantity <= min_quantity;

CREATE INDEX IF NOT EXISTS idx_van_movements_van ON van_stock_movements(van_id);
CREATE INDEX IF NOT EXISTS idx_van_movements_item ON van_stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_van_movements_job ON van_stock_movements(job_id);
CREATE INDEX IF NOT EXISTS idx_van_movements_date ON van_stock_movements(created_at);

CREATE INDEX IF NOT EXISTS idx_restock_requests_van ON van_restock_requests(van_id);
CREATE INDEX IF NOT EXISTS idx_restock_requests_status ON van_restock_requests(user_id, status);

CREATE INDEX IF NOT EXISTS idx_checkins_van ON van_stock_checkins(van_id);
CREATE INDEX IF NOT EXISTS idx_checkins_status ON van_stock_checkins(user_id, status);

-- Trigger for updating timestamps
CREATE OR REPLACE FUNCTION update_van_stock_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_service_vans_timestamp_trigger ON service_vans;
CREATE TRIGGER update_service_vans_timestamp_trigger
  BEFORE UPDATE ON service_vans
  FOR EACH ROW EXECUTE FUNCTION update_van_stock_timestamp();

DROP TRIGGER IF EXISTS update_van_stock_timestamp_trigger ON van_stock;
CREATE TRIGGER update_van_stock_timestamp_trigger
  BEFORE UPDATE ON van_stock
  FOR EACH ROW EXECUTE FUNCTION update_van_stock_timestamp();

DROP TRIGGER IF EXISTS update_restock_requests_timestamp_trigger ON van_restock_requests;
CREATE TRIGGER update_restock_requests_timestamp_trigger
  BEFORE UPDATE ON van_restock_requests
  FOR EACH ROW EXECUTE FUNCTION update_van_stock_timestamp();

-- Comments
COMMENT ON TABLE service_vans IS 'Service vehicles/vans with assigned technicians';
COMMENT ON TABLE van_stock IS 'Current stock levels in each van';
COMMENT ON TABLE van_stock_movements IS 'History of stock movements to/from vans';
COMMENT ON TABLE van_restock_requests IS 'Requests from technicians to restock their vans';
COMMENT ON TABLE van_stock_checkins IS 'Periodic stock check/inventory counts for vans';
