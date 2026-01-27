-- Xero Integration Schema
-- Phase 3: Accounting software integration

-- Xero connection/tokens storage
CREATE TABLE IF NOT EXISTS xero_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- OAuth tokens (encrypted in production)
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  expires_at TIMESTAMP,

  -- Tenant/Organization info
  tenant_id VARCHAR(100),
  tenant_name VARCHAR(255),
  tenant_type VARCHAR(50), -- 'ORGANISATION' or 'PRACTICE'

  -- Connection status
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  last_error TEXT,

  -- Settings
  auto_sync_contacts BOOLEAN DEFAULT true,
  auto_sync_invoices BOOLEAN DEFAULT true,
  sync_frequency_minutes INTEGER DEFAULT 60,
  default_account_code VARCHAR(50), -- Default revenue account
  default_tax_type VARCHAR(50) DEFAULT 'OUTPUT', -- GST on Sales

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id)
);

-- Xero sync log for tracking all sync operations
CREATE TABLE IF NOT EXISTS xero_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  sync_type VARCHAR(50) NOT NULL, -- 'contacts', 'invoices', 'payments', 'full'
  sync_direction VARCHAR(20) NOT NULL, -- 'to_xero', 'from_xero', 'bidirectional'

  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed', 'partial'

  -- Stats
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  -- Error details
  error_message TEXT,
  error_details JSONB,

  -- Timing
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Xero entity mappings (link PlumbPro entities to Xero entities)
CREATE TABLE IF NOT EXISTS xero_entity_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Entity type and IDs
  entity_type VARCHAR(50) NOT NULL, -- 'contact', 'invoice', 'payment', 'item'
  plumbpro_id UUID NOT NULL,
  xero_id VARCHAR(100) NOT NULL,

  -- Sync tracking
  last_synced_at TIMESTAMP,
  plumbpro_updated_at TIMESTAMP,
  xero_updated_at TIMESTAMP,
  sync_status VARCHAR(50) DEFAULT 'synced', -- 'synced', 'pending', 'conflict', 'error'

  -- Additional data
  metadata JSONB,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, entity_type, plumbpro_id),
  UNIQUE(user_id, entity_type, xero_id)
);

-- Xero invoice queue (for batching invoice syncs)
CREATE TABLE IF NOT EXISTS xero_invoice_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  action VARCHAR(20) NOT NULL, -- 'create', 'update', 'void'
  priority INTEGER DEFAULT 5, -- 1 = highest, 10 = lowest

  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,

  last_attempt_at TIMESTAMP,
  error_message TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,

  UNIQUE(user_id, invoice_id, action)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_xero_connections_user ON xero_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_xero_sync_logs_user ON xero_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_xero_sync_logs_status ON xero_sync_logs(status);
CREATE INDEX IF NOT EXISTS idx_xero_entity_mappings_user_type ON xero_entity_mappings(user_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_xero_entity_mappings_plumbpro ON xero_entity_mappings(plumbpro_id);
CREATE INDEX IF NOT EXISTS idx_xero_entity_mappings_xero ON xero_entity_mappings(xero_id);
CREATE INDEX IF NOT EXISTS idx_xero_invoice_queue_pending ON xero_invoice_queue(user_id, status) WHERE status = 'pending';

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_xero_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_xero_connections_updated_at ON xero_connections;
CREATE TRIGGER update_xero_connections_updated_at
  BEFORE UPDATE ON xero_connections
  FOR EACH ROW EXECUTE FUNCTION update_xero_updated_at();

DROP TRIGGER IF EXISTS update_xero_entity_mappings_updated_at ON xero_entity_mappings;
CREATE TRIGGER update_xero_entity_mappings_updated_at
  BEFORE UPDATE ON xero_entity_mappings
  FOR EACH ROW EXECUTE FUNCTION update_xero_updated_at();

-- Comments
COMMENT ON TABLE xero_connections IS 'Stores Xero OAuth tokens and connection settings per user';
COMMENT ON TABLE xero_sync_logs IS 'Audit log of all Xero synchronization operations';
COMMENT ON TABLE xero_entity_mappings IS 'Maps PlumbPro entities to their Xero counterparts';
COMMENT ON TABLE xero_invoice_queue IS 'Queue for batching invoice sync operations to Xero';
