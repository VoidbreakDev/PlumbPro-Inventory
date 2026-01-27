-- Team Management Schema
-- Phase 2: Basic team user management for PlumbPro

-- Teams/Organizations table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Subscription info
  subscription_tier VARCHAR(50) DEFAULT 'solo'
    CHECK (subscription_tier IN ('solo', 'team', 'business')),
  max_users INTEGER DEFAULT 1,

  -- Settings
  settings JSONB DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Extend users table with team membership
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_role VARCHAR(50) DEFAULT 'member'
    CHECK (team_role IN ('owner', 'admin', 'manager', 'member', 'viewer')),
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP;

-- Team invitations
CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'member'
    CHECK (role IN ('admin', 'manager', 'member', 'viewer')),

  -- Invitation details
  token VARCHAR(100) UNIQUE NOT NULL,
  invited_by UUID NOT NULL REFERENCES users(id),
  message TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  expires_at TIMESTAMP NOT NULL,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMP,
  declined_at TIMESTAMP
);

-- Role permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,

  -- Permission categories
  permission_category VARCHAR(100) NOT NULL,
  permission_action VARCHAR(100) NOT NULL,
  is_allowed BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(team_id, role, permission_category, permission_action)
);

-- Default permissions for each role (null team_id = system defaults)
INSERT INTO role_permissions (team_id, role, permission_category, permission_action, is_allowed)
VALUES
  -- Owner permissions (full access)
  (NULL, 'owner', 'jobs', 'view', true),
  (NULL, 'owner', 'jobs', 'create', true),
  (NULL, 'owner', 'jobs', 'edit', true),
  (NULL, 'owner', 'jobs', 'delete', true),
  (NULL, 'owner', 'jobs', 'assign', true),
  (NULL, 'owner', 'inventory', 'view', true),
  (NULL, 'owner', 'inventory', 'create', true),
  (NULL, 'owner', 'inventory', 'edit', true),
  (NULL, 'owner', 'inventory', 'delete', true),
  (NULL, 'owner', 'inventory', 'adjust', true),
  (NULL, 'owner', 'quotes', 'view', true),
  (NULL, 'owner', 'quotes', 'create', true),
  (NULL, 'owner', 'quotes', 'edit', true),
  (NULL, 'owner', 'quotes', 'delete', true),
  (NULL, 'owner', 'quotes', 'approve', true),
  (NULL, 'owner', 'quotes', 'send', true),
  (NULL, 'owner', 'invoices', 'view', true),
  (NULL, 'owner', 'invoices', 'create', true),
  (NULL, 'owner', 'invoices', 'edit', true),
  (NULL, 'owner', 'invoices', 'delete', true),
  (NULL, 'owner', 'invoices', 'send', true),
  (NULL, 'owner', 'invoices', 'record_payment', true),
  (NULL, 'owner', 'contacts', 'view', true),
  (NULL, 'owner', 'contacts', 'create', true),
  (NULL, 'owner', 'contacts', 'edit', true),
  (NULL, 'owner', 'contacts', 'delete', true),
  (NULL, 'owner', 'purchase_orders', 'view', true),
  (NULL, 'owner', 'purchase_orders', 'create', true),
  (NULL, 'owner', 'purchase_orders', 'edit', true),
  (NULL, 'owner', 'purchase_orders', 'delete', true),
  (NULL, 'owner', 'purchase_orders', 'receive', true),
  (NULL, 'owner', 'reports', 'view', true),
  (NULL, 'owner', 'reports', 'export', true),
  (NULL, 'owner', 'team', 'view', true),
  (NULL, 'owner', 'team', 'invite', true),
  (NULL, 'owner', 'team', 'manage', true),
  (NULL, 'owner', 'settings', 'view', true),
  (NULL, 'owner', 'settings', 'edit', true),

  -- Admin permissions (most access except settings)
  (NULL, 'admin', 'jobs', 'view', true),
  (NULL, 'admin', 'jobs', 'create', true),
  (NULL, 'admin', 'jobs', 'edit', true),
  (NULL, 'admin', 'jobs', 'delete', true),
  (NULL, 'admin', 'jobs', 'assign', true),
  (NULL, 'admin', 'inventory', 'view', true),
  (NULL, 'admin', 'inventory', 'create', true),
  (NULL, 'admin', 'inventory', 'edit', true),
  (NULL, 'admin', 'inventory', 'delete', true),
  (NULL, 'admin', 'inventory', 'adjust', true),
  (NULL, 'admin', 'quotes', 'view', true),
  (NULL, 'admin', 'quotes', 'create', true),
  (NULL, 'admin', 'quotes', 'edit', true),
  (NULL, 'admin', 'quotes', 'delete', true),
  (NULL, 'admin', 'quotes', 'approve', true),
  (NULL, 'admin', 'quotes', 'send', true),
  (NULL, 'admin', 'invoices', 'view', true),
  (NULL, 'admin', 'invoices', 'create', true),
  (NULL, 'admin', 'invoices', 'edit', true),
  (NULL, 'admin', 'invoices', 'send', true),
  (NULL, 'admin', 'invoices', 'record_payment', true),
  (NULL, 'admin', 'contacts', 'view', true),
  (NULL, 'admin', 'contacts', 'create', true),
  (NULL, 'admin', 'contacts', 'edit', true),
  (NULL, 'admin', 'purchase_orders', 'view', true),
  (NULL, 'admin', 'purchase_orders', 'create', true),
  (NULL, 'admin', 'purchase_orders', 'edit', true),
  (NULL, 'admin', 'purchase_orders', 'receive', true),
  (NULL, 'admin', 'reports', 'view', true),
  (NULL, 'admin', 'team', 'view', true),
  (NULL, 'admin', 'team', 'invite', true),

  -- Manager permissions
  (NULL, 'manager', 'jobs', 'view', true),
  (NULL, 'manager', 'jobs', 'create', true),
  (NULL, 'manager', 'jobs', 'edit', true),
  (NULL, 'manager', 'jobs', 'assign', true),
  (NULL, 'manager', 'inventory', 'view', true),
  (NULL, 'manager', 'inventory', 'adjust', true),
  (NULL, 'manager', 'quotes', 'view', true),
  (NULL, 'manager', 'quotes', 'create', true),
  (NULL, 'manager', 'quotes', 'edit', true),
  (NULL, 'manager', 'quotes', 'send', true),
  (NULL, 'manager', 'invoices', 'view', true),
  (NULL, 'manager', 'invoices', 'create', true),
  (NULL, 'manager', 'invoices', 'send', true),
  (NULL, 'manager', 'contacts', 'view', true),
  (NULL, 'manager', 'contacts', 'create', true),
  (NULL, 'manager', 'contacts', 'edit', true),
  (NULL, 'manager', 'purchase_orders', 'view', true),
  (NULL, 'manager', 'purchase_orders', 'create', true),
  (NULL, 'manager', 'purchase_orders', 'receive', true),
  (NULL, 'manager', 'reports', 'view', true),
  (NULL, 'manager', 'team', 'view', true),

  -- Member permissions (standard user)
  (NULL, 'member', 'jobs', 'view', true),
  (NULL, 'member', 'jobs', 'create', true),
  (NULL, 'member', 'jobs', 'edit', true),
  (NULL, 'member', 'inventory', 'view', true),
  (NULL, 'member', 'inventory', 'adjust', true),
  (NULL, 'member', 'quotes', 'view', true),
  (NULL, 'member', 'quotes', 'create', true),
  (NULL, 'member', 'invoices', 'view', true),
  (NULL, 'member', 'contacts', 'view', true),
  (NULL, 'member', 'purchase_orders', 'view', true),
  (NULL, 'member', 'purchase_orders', 'receive', true),

  -- Viewer permissions (read-only)
  (NULL, 'viewer', 'jobs', 'view', true),
  (NULL, 'viewer', 'inventory', 'view', true),
  (NULL, 'viewer', 'quotes', 'view', true),
  (NULL, 'viewer', 'invoices', 'view', true),
  (NULL, 'viewer', 'contacts', 'view', true),
  (NULL, 'viewer', 'purchase_orders', 'view', true),
  (NULL, 'viewer', 'reports', 'view', true)
ON CONFLICT DO NOTHING;

-- User activity log for team management
CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,

  action_type VARCHAR(100) NOT NULL,
  action_details JSONB,
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_team ON users(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team ON team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_team ON user_activity_log(team_id);

-- Function to check user permission
CREATE OR REPLACE FUNCTION check_user_permission(
  p_user_id UUID,
  p_category VARCHAR(100),
  p_action VARCHAR(100)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_team_id UUID;
  v_role VARCHAR(50);
  v_is_allowed BOOLEAN;
BEGIN
  -- Get user's team and role
  SELECT team_id, team_role INTO v_team_id, v_role
  FROM users WHERE id = p_user_id;

  -- Solo users (no team) get full access
  IF v_team_id IS NULL THEN
    RETURN true;
  END IF;

  -- Check team-specific permission first
  SELECT is_allowed INTO v_is_allowed
  FROM role_permissions
  WHERE team_id = v_team_id
    AND role = v_role
    AND permission_category = p_category
    AND permission_action = p_action;

  IF v_is_allowed IS NOT NULL THEN
    RETURN v_is_allowed;
  END IF;

  -- Fall back to system defaults
  SELECT is_allowed INTO v_is_allowed
  FROM role_permissions
  WHERE team_id IS NULL
    AND role = v_role
    AND permission_category = p_category
    AND permission_action = p_action;

  RETURN COALESCE(v_is_allowed, false);
END;
$$ LANGUAGE plpgsql;

-- Function to get all permissions for a role
CREATE OR REPLACE FUNCTION get_role_permissions(p_role VARCHAR(50), p_team_id UUID DEFAULT NULL)
RETURNS TABLE (
  category VARCHAR(100),
  action VARCHAR(100),
  is_allowed BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(tp.permission_category, dp.permission_category) as category,
    COALESCE(tp.permission_action, dp.permission_action) as action,
    COALESCE(tp.is_allowed, dp.is_allowed) as is_allowed
  FROM role_permissions dp
  LEFT JOIN role_permissions tp ON tp.team_id = p_team_id
    AND tp.role = dp.role
    AND tp.permission_category = dp.permission_category
    AND tp.permission_action = dp.permission_action
  WHERE dp.team_id IS NULL AND dp.role = p_role;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_team_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_teams_updated_at ON teams;
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_team_updated_at();

-- Comments
COMMENT ON TABLE teams IS 'Organizations/teams for multi-user functionality';
COMMENT ON TABLE team_invitations IS 'Pending invitations to join a team';
COMMENT ON TABLE role_permissions IS 'Role-based access control permissions';
COMMENT ON TABLE user_activity_log IS 'Audit trail of user actions';
COMMENT ON FUNCTION check_user_permission IS 'Check if a user has a specific permission';
