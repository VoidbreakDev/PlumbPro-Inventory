-- Mobile & Field Service Features Database Schema

-- Job Check-ins/Check-outs with GPS tracking
CREATE TABLE IF NOT EXISTS job_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  check_out_time TIMESTAMP,
  check_in_latitude DECIMAL(10, 8),
  check_in_longitude DECIMAL(11, 8),
  check_out_latitude DECIMAL(10, 8),
  check_out_longitude DECIMAL(11, 8),
  check_in_accuracy DECIMAL(10, 2), -- in meters
  check_out_accuracy DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_job_check_ins_job ON job_check_ins(job_id);
CREATE INDEX idx_job_check_ins_user ON job_check_ins(user_id);
CREATE INDEX idx_job_check_ins_time ON job_check_ins(check_in_time);

-- Job Photos (before/after, progress, issues)
CREATE TABLE IF NOT EXISTS job_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_in_id UUID REFERENCES job_check_ins(id) ON DELETE SET NULL,
  photo_type VARCHAR(50) NOT NULL, -- 'before', 'during', 'after', 'issue', 'completion'
  file_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER, -- in bytes
  mime_type VARCHAR(100),
  caption TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_job_photos_job ON job_photos(job_id);
CREATE INDEX idx_job_photos_type ON job_photos(photo_type);
CREATE INDEX idx_job_photos_user ON job_photos(user_id);

-- Digital Signatures
CREATE TABLE IF NOT EXISTS job_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_in_id UUID REFERENCES job_check_ins(id) ON DELETE SET NULL,
  signature_type VARCHAR(50) NOT NULL, -- 'customer', 'worker', 'supervisor'
  signature_data TEXT NOT NULL, -- Base64 encoded image or SVG path
  signer_name VARCHAR(255) NOT NULL,
  signer_email VARCHAR(255),
  signer_phone VARCHAR(50),
  ip_address VARCHAR(45),
  user_agent TEXT,
  signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_job_signatures_job ON job_signatures(job_id);
CREATE INDEX idx_job_signatures_type ON job_signatures(signature_type);

-- Field Notes & Voice Memos
CREATE TABLE IF NOT EXISTS job_field_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_in_id UUID REFERENCES job_check_ins(id) ON DELETE SET NULL,
  note_type VARCHAR(50) NOT NULL, -- 'text', 'voice', 'checklist'
  content TEXT NOT NULL,
  audio_file_path TEXT, -- for voice memos
  audio_duration INTEGER, -- in seconds
  is_important BOOLEAN DEFAULT FALSE,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_job_field_notes_job ON job_field_notes(job_id);
CREATE INDEX idx_job_field_notes_user ON job_field_notes(user_id);
CREATE INDEX idx_job_field_notes_important ON job_field_notes(is_important);

-- Barcode Scans & Item Verification
CREATE TABLE IF NOT EXISTS barcode_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  barcode_value VARCHAR(255) NOT NULL,
  barcode_type VARCHAR(50), -- 'EAN13', 'QR', 'CODE128', etc.
  scan_type VARCHAR(50) NOT NULL, -- 'inventory_check', 'job_allocation', 'stock_in', 'stock_out'
  quantity INTEGER DEFAULT 1,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_barcode_scans_user ON barcode_scans(user_id);
CREATE INDEX idx_barcode_scans_item ON barcode_scans(item_id);
CREATE INDEX idx_barcode_scans_barcode ON barcode_scans(barcode_value);

-- Mobile Device Registrations (for push notifications)
CREATE TABLE IF NOT EXISTS mobile_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL, -- FCM/APNS token
  device_type VARCHAR(50) NOT NULL, -- 'ios', 'android', 'web'
  device_name VARCHAR(255),
  os_version VARCHAR(50),
  app_version VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, device_token)
);

CREATE INDEX idx_mobile_devices_user ON mobile_devices(user_id);
CREATE INDEX idx_mobile_devices_active ON mobile_devices(is_active);

-- Offline Sync Queue (for when field workers are offline)
CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL, -- 'job', 'stock_movement', 'photo', etc.
  entity_id UUID,
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete'
  data JSONB NOT NULL,
  sync_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'synced', 'error'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synced_at TIMESTAMP
);

CREATE INDEX idx_offline_sync_user ON offline_sync_queue(user_id);
CREATE INDEX idx_offline_sync_status ON offline_sync_queue(sync_status);

-- GPS Tracking Breadcrumbs (for route optimization and time tracking)
CREATE TABLE IF NOT EXISTS gps_breadcrumbs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  check_in_id UUID REFERENCES job_check_ins(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(10, 2),
  altitude DECIMAL(10, 2),
  speed DECIMAL(10, 2), -- meters per second
  heading DECIMAL(5, 2), -- degrees
  battery_level INTEGER, -- percentage
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gps_breadcrumbs_user ON gps_breadcrumbs(user_id);
CREATE INDEX idx_gps_breadcrumbs_job ON gps_breadcrumbs(job_id);
CREATE INDEX idx_gps_breadcrumbs_check_in ON gps_breadcrumbs(check_in_id);
CREATE INDEX idx_gps_breadcrumbs_time ON gps_breadcrumbs(recorded_at);

-- Add barcode field to inventory items if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'barcode'
  ) THEN
    ALTER TABLE inventory_items ADD COLUMN barcode VARCHAR(255);
    CREATE INDEX idx_inventory_items_barcode ON inventory_items(barcode);
  END IF;
END $$;

-- Add location fields to jobs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'job_latitude'
  ) THEN
    ALTER TABLE jobs ADD COLUMN job_latitude DECIMAL(10, 8);
    ALTER TABLE jobs ADD COLUMN job_longitude DECIMAL(11, 8);
    ALTER TABLE jobs ADD COLUMN job_address TEXT;
  END IF;
END $$;

-- Update trigger for job_check_ins
CREATE OR REPLACE FUNCTION update_job_check_ins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_job_check_ins_updated_at
BEFORE UPDATE ON job_check_ins
FOR EACH ROW
EXECUTE FUNCTION update_job_check_ins_updated_at();

-- Update trigger for job_field_notes
CREATE TRIGGER trigger_job_field_notes_updated_at
BEFORE UPDATE ON job_field_notes
FOR EACH ROW
EXECUTE FUNCTION update_job_check_ins_updated_at();

-- Update trigger for mobile_devices
CREATE TRIGGER trigger_mobile_devices_updated_at
BEFORE UPDATE ON mobile_devices
FOR EACH ROW
EXECUTE FUNCTION update_job_check_ins_updated_at();
