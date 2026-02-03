-- Advanced Permissions Schema
-- Phase 3: Role-based access control with granular permissions

-- Role templates
CREATE TABLE IF NOT EXISTS role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Role identification
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Role level (for hierarchy)
  level INTEGER NOT NULL DEFAULT 0,
  -- 0 = Apprentice/New Hire
  -- 1 = Tradesperson
  -- 2 = Senior Tradesperson/Foreman
  -- 3 = Office Admin
  -- 4 = Manager
  -- 5 = Owner

  -- System role flags
  is_system_role BOOLEAN DEFAULT false,  -- Cannot be deleted
  is_default BOOLEAN DEFAULT false,  -- Assigned to new users

  -- Permissions (JSONB for flexibility)
  permissions JSONB NOT NULL DEFAULT '{}',

  -- Approval thresholds
  quote_approval_threshold DECIMAL(12, 2),  -- Can approve quotes up to this value
  po_approval_threshold DECIMAL(12, 2),  -- Can approve POs up to this value

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Custom roles per organization
CREATE TABLE IF NOT EXISTS custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- Owner who created it

  -- Role details
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Base template (if cloned from)
  base_template_id UUID REFERENCES role_templates(id),

  -- Permissions
  permissions JSONB NOT NULL DEFAULT '{}',

  -- Approval thresholds
  quote_approval_threshold DECIMAL(12, 2),
  po_approval_threshold DECIMAL(12, 2),

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, name)
);

-- User role assignments
CREATE TABLE IF NOT EXISTS user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The user being assigned
  assigned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Role (either template or custom)
  role_template_id UUID REFERENCES role_templates(id),
  custom_role_id UUID REFERENCES custom_roles(id),

  -- Who assigned and when
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Validity period (for temporary assignments)
  valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP,

  -- Override permissions (for user-specific adjustments)
  permission_overrides JSONB DEFAULT '{}',

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Either template or custom role, not both
  CHECK (
    (role_template_id IS NOT NULL AND custom_role_id IS NULL) OR
    (role_template_id IS NULL AND custom_role_id IS NOT NULL)
  )
);

-- Approval workflows
CREATE TABLE IF NOT EXISTS approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Workflow type
  workflow_type VARCHAR(50) NOT NULL
    CHECK (workflow_type IN ('quote', 'purchase_order', 'stock_adjustment', 'job_completion', 'invoice')),

  -- Trigger conditions
  trigger_condition JSONB NOT NULL,
  -- Example: { "amount_above": 1000, "category": "high_value" }

  -- Approval chain (ordered list of approver role levels or specific users)
  approval_chain JSONB NOT NULL,
  -- Example: [{ "type": "role", "value": "manager" }, { "type": "user", "value": "uuid" }]

  -- Settings
  require_all_approvers BOOLEAN DEFAULT false,
  auto_approve_after_hours INTEGER,  -- Auto-approve if no response
  notify_on_pending BOOLEAN DEFAULT true,
  escalation_hours INTEGER,  -- Escalate to next approver after X hours

  -- Status
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,  -- Higher = checked first

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pending approvals queue
CREATE TABLE IF NOT EXISTS pending_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- What needs approval
  entity_type VARCHAR(50) NOT NULL
    CHECK (entity_type IN ('quote', 'purchase_order', 'stock_adjustment', 'job', 'invoice')),
  entity_id UUID NOT NULL,

  -- Workflow used
  workflow_id UUID REFERENCES approval_workflows(id),

  -- Request details
  requested_by UUID NOT NULL REFERENCES users(id),
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  request_notes TEXT,

  -- Current state in approval chain
  current_approver_index INTEGER DEFAULT 0,

  -- Approval data
  approval_data JSONB,  -- Stores what's being approved (amount, changes, etc.)

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),

  -- Resolution
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,

  -- Deadline
  expires_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Approval history
CREATE TABLE IF NOT EXISTS approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_approval_id UUID NOT NULL REFERENCES pending_approvals(id) ON DELETE CASCADE,

  -- Approver details
  approver_id UUID NOT NULL REFERENCES users(id),
  approver_index INTEGER NOT NULL,

  -- Action
  action VARCHAR(50) NOT NULL
    CHECK (action IN ('approved', 'rejected', 'escalated', 'delegated')),

  -- Notes
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permission audit log
CREATE TABLE IF NOT EXISTS permission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- What happened
  action_type VARCHAR(50) NOT NULL
    CHECK (action_type IN (
      'role_assigned', 'role_removed', 'permission_changed',
      'access_granted', 'access_denied', 'approval_granted', 'approval_denied'
    )),

  -- Target user
  target_user_id UUID REFERENCES users(id),

  -- Details
  details JSONB NOT NULL,

  -- Context
  ip_address VARCHAR(45),
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_role_templates_level ON role_templates(level);
CREATE INDEX IF NOT EXISTS idx_custom_roles_user ON custom_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user ON user_role_assignments(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_active ON user_role_assignments(assigned_user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_user ON approval_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_type ON approval_workflows(workflow_type);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_user ON pending_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_status ON pending_approvals(status);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_entity ON pending_approvals(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_log_user ON permission_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_log_target ON permission_audit_log(target_user_id);

-- Insert default role templates
INSERT INTO role_templates (name, display_name, description, level, is_system_role, permissions, quote_approval_threshold, po_approval_threshold)
VALUES
  (
    'apprentice',
    'Apprentice / New Hire',
    'Entry-level role with limited access. Can view assigned jobs and perform basic time tracking.',
    0,
    true,
    '{
      "jobs": {"view_own": true, "view_all": false, "create": false, "edit": false, "delete": false, "complete": false, "assign": false},
      "inventory": {"view": true, "view_costs": false, "pick": false, "return": false, "adjust": false},
      "quotes": {"view": false, "create": false, "edit": false, "send": false, "approve": false},
      "invoices": {"view": false, "create": false, "edit": false, "send": false, "record_payment": false},
      "customers": {"view_list": false, "view_details": false, "create": false, "edit": false, "delete": false},
      "purchase_orders": {"view": false, "create": false, "approve": false, "receive": false},
      "reports": {"view": false, "create": false, "export": false},
      "settings": {"view": false, "edit": false},
      "users": {"view": false, "create": false, "edit": false, "delete": false, "manage_roles": false}
    }',
    0,
    0
  ),
  (
    'tradesperson',
    'Tradesperson',
    'Standard field worker. Can manage assigned jobs, pick stock, and create quotes for approval.',
    1,
    true,
    '{
      "jobs": {"view_own": true, "view_all": false, "create": false, "edit": true, "delete": false, "complete": true, "assign": false},
      "inventory": {"view": true, "view_costs": false, "pick": true, "return": true, "adjust": false},
      "quotes": {"view": true, "create": true, "edit": true, "send": false, "approve": false},
      "invoices": {"view": false, "create": false, "edit": false, "send": false, "record_payment": false},
      "customers": {"view_list": true, "view_details": false, "create": false, "edit": false, "delete": false},
      "purchase_orders": {"view": false, "create": false, "approve": false, "receive": false},
      "reports": {"view": false, "create": false, "export": false},
      "settings": {"view": false, "edit": false},
      "users": {"view": false, "create": false, "edit": false, "delete": false, "manage_roles": false}
    }',
    500,
    0
  ),
  (
    'senior_tradesperson',
    'Senior Tradesperson / Foreman',
    'Experienced field worker with team lead capabilities. Can assign jobs, approve small quotes, and manage stock.',
    2,
    true,
    '{
      "jobs": {"view_own": true, "view_all": true, "create": true, "edit": true, "delete": false, "complete": true, "assign": true},
      "inventory": {"view": true, "view_costs": true, "pick": true, "return": true, "adjust": true},
      "quotes": {"view": true, "create": true, "edit": true, "send": true, "approve": true},
      "invoices": {"view": true, "create": false, "edit": false, "send": false, "record_payment": false},
      "customers": {"view_list": true, "view_details": true, "create": true, "edit": true, "delete": false},
      "purchase_orders": {"view": true, "create": true, "approve": false, "receive": true},
      "reports": {"view": true, "create": false, "export": false},
      "settings": {"view": false, "edit": false},
      "users": {"view": true, "create": false, "edit": false, "delete": false, "manage_roles": false}
    }',
    2000,
    1000
  ),
  (
    'office_admin',
    'Office Administrator',
    'Office-based role focused on invoicing, payments, and customer management.',
    3,
    true,
    '{
      "jobs": {"view_own": true, "view_all": true, "create": true, "edit": true, "delete": false, "complete": false, "assign": true},
      "inventory": {"view": true, "view_costs": true, "pick": false, "return": false, "adjust": false},
      "quotes": {"view": true, "create": true, "edit": true, "send": true, "approve": false},
      "invoices": {"view": true, "create": true, "edit": true, "send": true, "record_payment": true},
      "customers": {"view_list": true, "view_details": true, "create": true, "edit": true, "delete": false},
      "purchase_orders": {"view": true, "create": true, "approve": false, "receive": false},
      "reports": {"view": true, "create": true, "export": true},
      "settings": {"view": true, "edit": false},
      "users": {"view": true, "create": false, "edit": false, "delete": false, "manage_roles": false}
    }',
    5000,
    2500
  ),
  (
    'manager',
    'Manager',
    'Full operational access without financial settings. Can manage users and most system settings.',
    4,
    true,
    '{
      "jobs": {"view_own": true, "view_all": true, "create": true, "edit": true, "delete": true, "complete": true, "assign": true},
      "inventory": {"view": true, "view_costs": true, "pick": true, "return": true, "adjust": true},
      "quotes": {"view": true, "create": true, "edit": true, "send": true, "approve": true},
      "invoices": {"view": true, "create": true, "edit": true, "send": true, "record_payment": true},
      "customers": {"view_list": true, "view_details": true, "create": true, "edit": true, "delete": true},
      "purchase_orders": {"view": true, "create": true, "approve": true, "receive": true},
      "reports": {"view": true, "create": true, "export": true},
      "settings": {"view": true, "edit": true},
      "users": {"view": true, "create": true, "edit": true, "delete": false, "manage_roles": true}
    }',
    25000,
    10000
  ),
  (
    'owner',
    'Owner',
    'Full system access including financial settings, billing, and user management.',
    5,
    true,
    '{
      "jobs": {"view_own": true, "view_all": true, "create": true, "edit": true, "delete": true, "complete": true, "assign": true},
      "inventory": {"view": true, "view_costs": true, "pick": true, "return": true, "adjust": true},
      "quotes": {"view": true, "create": true, "edit": true, "send": true, "approve": true},
      "invoices": {"view": true, "create": true, "edit": true, "send": true, "record_payment": true},
      "customers": {"view_list": true, "view_details": true, "create": true, "edit": true, "delete": true},
      "purchase_orders": {"view": true, "create": true, "approve": true, "receive": true},
      "reports": {"view": true, "create": true, "export": true},
      "settings": {"view": true, "edit": true, "financial": true, "billing": true, "integrations": true},
      "users": {"view": true, "create": true, "edit": true, "delete": true, "manage_roles": true}
    }',
    NULL,
    NULL
  )
ON CONFLICT (name) DO NOTHING;

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION check_user_permission(
  p_user_id UUID,
  p_permission_path TEXT  -- e.g., 'jobs.create' or 'inventory.view_costs'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_permissions JSONB;
  v_path_parts TEXT[];
  v_current JSONB;
  v_result BOOLEAN;
BEGIN
  -- Get user's effective permissions
  SELECT
    COALESCE(
      ura.permission_overrides,
      CASE
        WHEN ura.role_template_id IS NOT NULL THEN rt.permissions
        WHEN ura.custom_role_id IS NOT NULL THEN cr.permissions
      END
    )
  INTO v_permissions
  FROM user_role_assignments ura
  LEFT JOIN role_templates rt ON ura.role_template_id = rt.id
  LEFT JOIN custom_roles cr ON ura.custom_role_id = cr.id
  WHERE ura.assigned_user_id = p_user_id
    AND ura.is_active = true
    AND (ura.valid_until IS NULL OR ura.valid_until > CURRENT_TIMESTAMP)
  ORDER BY
    CASE
      WHEN rt.id IS NOT NULL THEN rt.level
      ELSE 99
    END DESC
  LIMIT 1;

  IF v_permissions IS NULL THEN
    RETURN false;
  END IF;

  -- Parse permission path
  v_path_parts := string_to_array(p_permission_path, '.');
  v_current := v_permissions;

  FOR i IN 1..array_length(v_path_parts, 1) LOOP
    v_current := v_current -> v_path_parts[i];
    IF v_current IS NULL THEN
      RETURN false;
    END IF;
  END LOOP;

  -- Return the boolean value
  RETURN COALESCE(v_current::text::boolean, false);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updating timestamps
CREATE OR REPLACE FUNCTION update_permissions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_role_templates_timestamp ON role_templates;
CREATE TRIGGER update_role_templates_timestamp
  BEFORE UPDATE ON role_templates
  FOR EACH ROW EXECUTE FUNCTION update_permissions_timestamp();

DROP TRIGGER IF EXISTS update_custom_roles_timestamp ON custom_roles;
CREATE TRIGGER update_custom_roles_timestamp
  BEFORE UPDATE ON custom_roles
  FOR EACH ROW EXECUTE FUNCTION update_permissions_timestamp();

DROP TRIGGER IF EXISTS update_approval_workflows_timestamp ON approval_workflows;
CREATE TRIGGER update_approval_workflows_timestamp
  BEFORE UPDATE ON approval_workflows
  FOR EACH ROW EXECUTE FUNCTION update_permissions_timestamp();

-- Comments
COMMENT ON TABLE role_templates IS 'Pre-defined role templates with permission sets';
COMMENT ON TABLE custom_roles IS 'Custom roles created by organization owners';
COMMENT ON TABLE user_role_assignments IS 'Maps users to roles (template or custom)';
COMMENT ON TABLE approval_workflows IS 'Configurable approval workflows for various entity types';
COMMENT ON TABLE pending_approvals IS 'Queue of items awaiting approval';
COMMENT ON TABLE permission_audit_log IS 'Audit trail for permission-related actions';
COMMENT ON FUNCTION check_user_permission IS 'Check if user has specific permission';
