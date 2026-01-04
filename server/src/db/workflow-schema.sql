-- Workflow Automation Database Schema

-- Workflow Definitions
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(50) NOT NULL, -- 'stock_level', 'job_status', 'time_schedule', 'manual', 'webhook'
  trigger_config JSONB NOT NULL, -- Configuration for trigger
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0, -- Higher priority workflows run first
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workflows_user ON workflows(user_id);
CREATE INDEX idx_workflows_active ON workflows(is_active);
CREATE INDEX idx_workflows_trigger ON workflows(trigger_type);

-- Workflow Actions (what to do when triggered)
CREATE TABLE IF NOT EXISTS workflow_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  action_order INTEGER NOT NULL, -- Order of execution
  action_type VARCHAR(50) NOT NULL, -- 'send_notification', 'create_job', 'update_stock', 'send_email', 'webhook', 'assign_worker'
  action_config JSONB NOT NULL, -- Configuration for action
  retry_on_failure BOOLEAN DEFAULT TRUE,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workflow_actions_workflow ON workflow_actions(workflow_id);
CREATE INDEX idx_workflow_actions_order ON workflow_actions(action_order);

-- Workflow Execution History
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trigger_data JSONB, -- Data that triggered the workflow
  status VARCHAR(50) NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed', 'cancelled'
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  execution_time_ms INTEGER
);

CREATE INDEX idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_started ON workflow_executions(started_at);

-- Workflow Action Execution Logs
CREATE TABLE IF NOT EXISTS workflow_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
  action_id UUID NOT NULL REFERENCES workflow_actions(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'success', 'failed', 'skipped'
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  execution_time_ms INTEGER
);

CREATE INDEX idx_workflow_action_logs_execution ON workflow_action_logs(execution_id);
CREATE INDEX idx_workflow_action_logs_action ON workflow_action_logs(action_id);
CREATE INDEX idx_workflow_action_logs_status ON workflow_action_logs(status);

-- Scheduled Tasks (for time-based workflows)
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  schedule_type VARCHAR(50) NOT NULL, -- 'once', 'daily', 'weekly', 'monthly', 'cron'
  schedule_config JSONB NOT NULL, -- When to run (cron expression, specific times, etc.)
  next_run_at TIMESTAMP,
  last_run_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scheduled_tasks_user ON scheduled_tasks(user_id);
CREATE INDEX idx_scheduled_tasks_workflow ON scheduled_tasks(workflow_id);
CREATE INDEX idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at);
CREATE INDEX idx_scheduled_tasks_active ON scheduled_tasks(is_active);

-- Workflow Templates (pre-built workflows)
CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100), -- 'inventory', 'jobs', 'notifications', 'reporting'
  trigger_type VARCHAR(50) NOT NULL,
  trigger_config JSONB NOT NULL,
  actions JSONB NOT NULL, -- Array of action configurations
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_workflow_templates_category ON workflow_templates(category);
CREATE INDEX idx_workflow_templates_public ON workflow_templates(is_public);

-- Auto-Assignment Rules
CREATE TABLE IF NOT EXISTS assignment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- 'job', 'stock_check', 'delivery'
  rule_conditions JSONB NOT NULL, -- Conditions to match
  assignment_strategy VARCHAR(50) NOT NULL, -- 'round_robin', 'least_busy', 'skills_based', 'location_based'
  assignment_config JSONB NOT NULL, -- Configuration for assignment
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assignment_rules_user ON assignment_rules(user_id);
CREATE INDEX idx_assignment_rules_entity ON assignment_rules(entity_type);
CREATE INDEX idx_assignment_rules_active ON assignment_rules(is_active);

-- Stock Alerts & Triggers
CREATE TABLE IF NOT EXISTS stock_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  trigger_type VARCHAR(50) NOT NULL, -- 'below_reorder', 'out_of_stock', 'overstocked', 'price_change', 'expiry_approaching'
  threshold_value DECIMAL(10, 2),
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stock_triggers_user ON stock_triggers(user_id);
CREATE INDEX idx_stock_triggers_item ON stock_triggers(item_id);
CREATE INDEX idx_stock_triggers_type ON stock_triggers(trigger_type);
CREATE INDEX idx_stock_triggers_active ON stock_triggers(is_active);

-- Business Rules Engine
CREATE TABLE IF NOT EXISTS business_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  rule_type VARCHAR(50) NOT NULL, -- 'validation', 'calculation', 'decision', 'routing'
  entity_type VARCHAR(50) NOT NULL, -- What this rule applies to
  conditions JSONB NOT NULL, -- When this rule applies
  actions JSONB NOT NULL, -- What to do when rule matches
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_business_rules_user ON business_rules(user_id);
CREATE INDEX idx_business_rules_type ON business_rules(rule_type);
CREATE INDEX idx_business_rules_entity ON business_rules(entity_type);
CREATE INDEX idx_business_rules_active ON business_rules(is_active);

-- Approval Workflows
CREATE TABLE IF NOT EXISTS approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL, -- 'job', 'purchase_order', 'stock_adjustment'
  entity_id UUID NOT NULL,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  current_stage INTEGER DEFAULT 1,
  total_stages INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'cancelled'
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_approval_workflows_user ON approval_workflows(user_id);
CREATE INDEX idx_approval_workflows_entity ON approval_workflows(entity_type, entity_id);
CREATE INDEX idx_approval_workflows_status ON approval_workflows(status);

-- Approval Stages
CREATE TABLE IF NOT EXISTS approval_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_workflow_id UUID NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
  stage_number INTEGER NOT NULL,
  approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  comments TEXT,
  responded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_approval_stages_workflow ON approval_stages(approval_workflow_id);
CREATE INDEX idx_approval_stages_approver ON approval_stages(approver_id);
CREATE INDEX idx_approval_stages_status ON approval_stages(status);

-- Update triggers for timestamps
CREATE OR REPLACE FUNCTION update_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workflows_updated_at
BEFORE UPDATE ON workflows
FOR EACH ROW
EXECUTE FUNCTION update_workflows_updated_at();

CREATE TRIGGER trigger_scheduled_tasks_updated_at
BEFORE UPDATE ON scheduled_tasks
FOR EACH ROW
EXECUTE FUNCTION update_workflows_updated_at();

CREATE TRIGGER trigger_assignment_rules_updated_at
BEFORE UPDATE ON assignment_rules
FOR EACH ROW
EXECUTE FUNCTION update_workflows_updated_at();

CREATE TRIGGER trigger_business_rules_updated_at
BEFORE UPDATE ON business_rules
FOR EACH ROW
EXECUTE FUNCTION update_workflows_updated_at();

-- Function to calculate next run time for scheduled tasks
CREATE OR REPLACE FUNCTION calculate_next_run(
  schedule_type VARCHAR(50),
  schedule_config JSONB,
  last_run TIMESTAMP
) RETURNS TIMESTAMP AS $$
DECLARE
  next_run TIMESTAMP;
BEGIN
  CASE schedule_type
    WHEN 'daily' THEN
      next_run := COALESCE(last_run, CURRENT_TIMESTAMP) + INTERVAL '1 day';
    WHEN 'weekly' THEN
      next_run := COALESCE(last_run, CURRENT_TIMESTAMP) + INTERVAL '1 week';
    WHEN 'monthly' THEN
      next_run := COALESCE(last_run, CURRENT_TIMESTAMP) + INTERVAL '1 month';
    ELSE
      next_run := CURRENT_TIMESTAMP + INTERVAL '1 hour';
  END CASE;

  RETURN next_run;
END;
$$ LANGUAGE plpgsql;
