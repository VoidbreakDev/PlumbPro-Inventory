-- ============================================================================
-- Migration 007: Restore permissions, settings, analytics compatibility,
--                and van stock schema parity for live PostgreSQL upgrades
-- ============================================================================

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) NOT NULL DEFAULT 'AUD',
  ADD COLUMN IF NOT EXISTS locale VARCHAR(10) NOT NULL DEFAULT 'en-AU';

CREATE TABLE IF NOT EXISTS ai_provider_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  encrypted_key TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_keys_user ON ai_provider_keys(user_id);

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;

UPDATE jobs
SET completed_at = updated_at
WHERE status = 'Completed'
  AND completed_at IS NULL;

CREATE TABLE IF NOT EXISTS role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  level INTEGER NOT NULL DEFAULT 0,
  is_system_role BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  quote_approval_threshold DECIMAL(12, 2),
  po_approval_threshold DECIMAL(12, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  base_template_id UUID REFERENCES role_templates(id),
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  quote_approval_threshold DECIMAL(12, 2),
  po_approval_threshold DECIMAL(12, 2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_template_id UUID REFERENCES role_templates(id),
  custom_role_id UUID REFERENCES custom_roles(id),
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP,
  permission_overrides JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (role_template_id IS NOT NULL AND custom_role_id IS NULL) OR
    (role_template_id IS NULL AND custom_role_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS permission_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL
    CHECK (entity_type IN ('quote', 'purchase_order', 'invoice', 'stock_adjustment', 'expense')),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  threshold_min DECIMAL(12, 2),
  threshold_max DECIMAL(12, 2),
  required_role_level INTEGER NOT NULL DEFAULT 1,
  required_role_name VARCHAR(255),
  require_multiple_approvers BOOLEAN DEFAULT false,
  min_approvers INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pending_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL
    CHECK (entity_type IN ('quote', 'purchase_order', 'stock_adjustment', 'job', 'invoice')),
  entity_id UUID NOT NULL,
  workflow_id UUID REFERENCES permission_workflows(id) ON DELETE SET NULL,
  requested_by UUID NOT NULL REFERENCES users(id),
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  request_notes TEXT,
  current_approver_index INTEGER DEFAULT 0,
  approval_data JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_approval_id UUID NOT NULL REFERENCES pending_approvals(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES users(id),
  approver_index INTEGER NOT NULL DEFAULT 0,
  action VARCHAR(50) NOT NULL
    CHECK (action IN ('approved', 'rejected', 'escalated', 'delegated')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL
    CHECK (action_type IN (
      'role_assigned', 'role_removed', 'permission_changed',
      'access_granted', 'access_denied', 'approval_granted', 'approval_denied'
    )),
  target_user_id UUID REFERENCES users(id),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_role_templates_level ON role_templates(level);
CREATE INDEX IF NOT EXISTS idx_custom_roles_user ON custom_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user ON user_role_assignments(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_active ON user_role_assignments(assigned_user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_permission_workflows_user ON permission_workflows(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_user ON pending_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_status ON pending_approvals(status);
CREATE INDEX IF NOT EXISTS idx_permission_audit_log_user ON permission_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_log_target ON permission_audit_log(target_user_id);

INSERT INTO role_templates (
  name, display_name, description, level, is_system_role, is_default, permissions,
  quote_approval_threshold, po_approval_threshold
)
VALUES
  (
    'apprentice',
    'Apprentice / New Hire',
    'Entry-level role with limited operational access.',
    0,
    true,
    false,
    '{"inventory":{"view":true,"create":false,"edit":false,"delete":false},"jobs":{"view":true,"create":false,"edit":false,"delete":false},"quotes":{"view":false,"create":false,"edit":false,"delete":false},"invoices":{"view":false,"create":false,"edit":false,"delete":false},"contacts":{"view":false,"create":false,"edit":false,"delete":false},"purchase_orders":{"view":false,"create":false,"edit":false,"delete":false},"reports":{"view":false,"export":false,"create_custom":false},"settings":{"view":false,"edit":false,"manage_users":false,"manage_integrations":false},"team":{"view":false,"manage":false,"view_wages":false}}'::jsonb,
    0,
    0
  ),
  (
    'tradesperson',
    'Tradesperson',
    'Standard field staff role.',
    1,
    true,
    true,
    '{"inventory":{"view":true,"create":false,"edit":false,"delete":false},"jobs":{"view":true,"create":false,"edit":true,"delete":false,"assign":false,"complete":true},"quotes":{"view":true,"create":true,"edit":true,"delete":false,"send":false,"convert":false},"invoices":{"view":false,"create":false,"edit":false,"delete":false,"send":false,"record_payment":false},"contacts":{"view":true,"create":false,"edit":false,"delete":false},"purchase_orders":{"view":false,"create":false,"edit":false,"delete":false,"send":false,"receive":false},"reports":{"view":false,"export":false,"create_custom":false},"settings":{"view":false,"edit":false,"manage_users":false,"manage_integrations":false},"team":{"view":false,"manage":false,"view_wages":false}}'::jsonb,
    500,
    0
  ),
  (
    'manager',
    'Manager',
    'Operational manager with approval capability.',
    4,
    true,
    false,
    '{"inventory":{"view":true,"create":true,"edit":true,"delete":false,"adjust_stock":true,"transfer":true},"jobs":{"view":true,"create":true,"edit":true,"delete":false,"assign":true,"complete":true},"quotes":{"view":true,"create":true,"edit":true,"delete":false,"send":true,"convert":true,"approve":true},"invoices":{"view":true,"create":true,"edit":true,"delete":false,"send":true,"record_payment":true},"contacts":{"view":true,"create":true,"edit":true,"delete":false},"purchase_orders":{"view":true,"create":true,"edit":true,"delete":false,"send":true,"receive":true},"reports":{"view":true,"export":true,"create_custom":true},"settings":{"view":true,"edit":true,"manage_users":true,"manage_integrations":true},"team":{"view":true,"manage":true,"view_wages":true}}'::jsonb,
    5000,
    2500
  ),
  (
    'owner',
    'Owner',
    'Full system access.',
    5,
    true,
    false,
    '{"inventory":{"view":true,"create":true,"edit":true,"delete":true,"adjust_stock":true,"transfer":true},"jobs":{"view":true,"create":true,"edit":true,"delete":true,"assign":true,"complete":true},"quotes":{"view":true,"create":true,"edit":true,"delete":true,"send":true,"convert":true,"approve":true},"invoices":{"view":true,"create":true,"edit":true,"delete":true,"send":true,"record_payment":true},"contacts":{"view":true,"create":true,"edit":true,"delete":true},"purchase_orders":{"view":true,"create":true,"edit":true,"delete":true,"send":true,"receive":true},"reports":{"view":true,"export":true,"create_custom":true},"settings":{"view":true,"edit":true,"manage_users":true,"manage_integrations":true},"team":{"view":true,"manage":true,"view_wages":true}}'::jsonb,
    NULL,
    NULL
  )
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS van_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  van_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER DEFAULT 0,
  max_quantity INTEGER,
  last_restocked_at TIMESTAMP,
  restocked_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  bin_location VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(van_id, item_id)
);

CREATE TABLE IF NOT EXISTS van_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  van_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  movement_type VARCHAR(50) NOT NULL
    CHECK (movement_type IN (
      'restock', 'return', 'job_usage', 'transfer_in',
      'transfer_out', 'adjustment', 'damaged', 'lost'
    )),
  quantity INTEGER NOT NULL,
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  source_van_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  destination_van_id TEXT REFERENCES assets(id) ON DELETE SET NULL,
  source_location_id UUID,
  performed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  performed_by_name VARCHAR(255),
  notes TEXT,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS van_restock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  van_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  requested_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_by_name VARCHAR(255),
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'processing', 'ready', 'completed', 'cancelled')),
  priority VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  notes TEXT,
  pickup_location VARCHAR(255),
  pickup_time TIMESTAMP,
  approved_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  processed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  processed_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS van_restock_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES van_restock_requests(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity_requested INTEGER NOT NULL,
  quantity_approved INTEGER,
  quantity_fulfilled INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(request_id, item_id)
);

CREATE TABLE IF NOT EXISTS van_stock_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  van_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  checkin_type VARCHAR(20) NOT NULL DEFAULT 'daily'
    CHECK (checkin_type IN ('daily', 'weekly', 'monthly', 'ad_hoc')),
  performed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  performed_by_name VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed', 'discrepancies_pending')),
  total_items_checked INTEGER DEFAULT 0,
  discrepancies_found INTEGER DEFAULT 0,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  notes TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS van_stock_checkin_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id UUID NOT NULL REFERENCES van_stock_checkins(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  expected_quantity INTEGER NOT NULL,
  counted_quantity INTEGER,
  discrepancy INTEGER GENERATED ALWAYS AS (counted_quantity - expected_quantity) STORED,
  discrepancy_reason TEXT,
  discrepancy_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(checkin_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_van_stock_van ON van_stock(van_id);
CREATE INDEX IF NOT EXISTS idx_van_stock_item ON van_stock(item_id);
CREATE INDEX IF NOT EXISTS idx_van_stock_low ON van_stock(van_id) WHERE quantity <= min_quantity;
CREATE INDEX IF NOT EXISTS idx_van_movements_van ON van_stock_movements(van_id);
CREATE INDEX IF NOT EXISTS idx_van_movements_item ON van_stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_van_movements_date ON van_stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_restock_requests_van ON van_restock_requests(van_id);
CREATE INDEX IF NOT EXISTS idx_restock_requests_status ON van_restock_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_checkins_van ON van_stock_checkins(van_id);
CREATE INDEX IF NOT EXISTS idx_checkins_status ON van_stock_checkins(user_id, status);

COMMIT;
