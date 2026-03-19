-- PlumbPro Inventory Database Schema
-- Drop existing tables (in correct order due to foreign keys)
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS job_allocated_items CASCADE;
DROP TABLE IF EXISTS job_workers CASCADE;
DROP TABLE IF EXISTS template_items CASCADE;
DROP TABLE IF EXISTS development_stages CASCADE;
DROP TABLE IF EXISTS development_projects CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS job_templates CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS ai_provider_keys CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table (for authentication and multi-tenancy)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user', -- admin, manager, user, viewer
  company_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- AI provider keys (encrypted at rest)
CREATE TABLE ai_provider_keys (
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

CREATE INDEX idx_ai_provider_keys_user ON ai_provider_keys(user_id);

-- Contacts table
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('Supplier', 'Plumber', 'Customer')),
  email VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_type ON contacts(type);

-- Inventory items table
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 0,
  supplier_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  supplier_code VARCHAR(100),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inventory_user_id ON inventory_items(user_id);
CREATE INDEX idx_inventory_category ON inventory_items(category);
CREATE INDEX idx_inventory_supplier ON inventory_items(supplier_id);

-- Job templates table
CREATE TABLE job_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_templates_user_id ON job_templates(user_id);

-- Template items (many-to-many with quantities)
CREATE TABLE template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES job_templates(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  UNIQUE(template_id, item_id)
);

CREATE INDEX idx_template_items_template ON template_items(template_id);
CREATE INDEX idx_template_items_item ON template_items(item_id);

-- Development projects table
CREATE TABLE development_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  builder VARCHAR(255),
  customer_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  site_address TEXT,
  target_start_date DATE,
  target_completion_date DATE,
  notes TEXT,
  house_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  overall_status VARCHAR(50) NOT NULL DEFAULT 'Planning'
    CHECK (overall_status IN ('Planning', 'Active', 'Completed', 'On Hold', 'Cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_development_projects_user_id ON development_projects(user_id);
CREATE INDEX idx_development_projects_customer_id ON development_projects(customer_id);
CREATE INDEX idx_development_projects_status ON development_projects(overall_status);

-- Development stages table
CREATE TABLE development_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES development_projects(id) ON DELETE CASCADE,
  stage_type VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'scheduled', 'in_progress', 'completed', 'skipped', 'blocked')),
  planned_date DATE,
  assigned_worker_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  base_kit_id VARCHAR(255),
  base_kit_name VARCHAR(255),
  variation_id VARCHAR(255),
  variation_name VARCHAR(255),
  modifier_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_allocated_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  manual_item_adjustments JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_applicable BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, stage_type)
);

CREATE INDEX idx_development_stages_user_id ON development_stages(user_id);
CREATE INDEX idx_development_stages_project_id ON development_stages(project_id);
CREATE INDEX idx_development_stages_status ON development_stages(status);
CREATE INDEX idx_development_stages_planned_date ON development_stages(planned_date);

-- Jobs table
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  builder VARCHAR(255),
  customer_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  job_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled')),
  date DATE NOT NULL,
  is_picked BOOLEAN DEFAULT false,
  job_address TEXT,
  development_project_id UUID REFERENCES development_projects(id) ON DELETE SET NULL,
  development_stage_id UUID UNIQUE REFERENCES development_stages(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_date ON jobs(date);
CREATE INDEX idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX idx_jobs_development_project_id ON jobs(development_project_id);

-- Job workers (many-to-many relationship)
CREATE TABLE job_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  UNIQUE(job_id, worker_id)
);

CREATE INDEX idx_job_workers_job ON job_workers(job_id);
CREATE INDEX idx_job_workers_worker ON job_workers(worker_id);

-- Job allocated items (many-to-many with quantities)
CREATE TABLE job_allocated_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  UNIQUE(job_id, item_id)
);

CREATE INDEX idx_allocated_items_job ON job_allocated_items(job_id);
CREATE INDEX idx_allocated_items_item ON job_allocated_items(item_id);

-- Stock movements (audit trail)
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('In', 'Out', 'Adjustment', 'Allocation')),
  quantity INTEGER NOT NULL,
  reference VARCHAR(255),
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_movements_user_id ON stock_movements(user_id);
CREATE INDEX idx_movements_item ON stock_movements(item_id);
CREATE INDEX idx_movements_type ON stock_movements(type);
CREATE INDEX idx_movements_timestamp ON stock_movements(timestamp);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON job_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PHASE 7: Customer Portal & Invoice System
-- ============================================

-- Customer portal access tokens (for magic link authentication)
CREATE TABLE customer_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_portal_tokens_contact ON customer_portal_tokens(contact_id);
CREATE INDEX idx_portal_tokens_token ON customer_portal_tokens(token);

-- Invoices table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  invoice_number VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  terms TEXT,
  sent_at TIMESTAMP,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_contact_id ON invoices(contact_id);
CREATE INDEX idx_invoices_job_id ON invoices(job_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Invoice items (line items)
CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  item_type VARCHAR(50) DEFAULT 'material' CHECK (item_type IN ('material', 'labor', 'service', 'other')),
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_inventory ON invoice_items(inventory_item_id);

-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('credit_card', 'bank_transfer', 'cash', 'check', 'stripe', 'other')),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  reference VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_stripe_intent ON payments(stripe_payment_intent_id);
CREATE INDEX idx_payments_date ON payments(payment_date);

-- Email templates
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body_html TEXT,
  body_text TEXT,
  variables JSONB DEFAULT '[]',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

CREATE INDEX idx_email_templates_user ON email_templates(user_id);

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Email queue (for async email sending)
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  to_address VARCHAR(255) NOT NULL,
  to_name VARCHAR(255),
  subject VARCHAR(500) NOT NULL,
  body_html TEXT,
  body_text TEXT,
  variables JSONB DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  sent_at TIMESTAMP,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_user ON email_queue(user_id);
CREATE INDEX idx_email_queue_created ON email_queue(created_at);

-- Service agreements (recurring maintenance contracts)
CREATE TABLE service_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'annually')),
  start_date DATE NOT NULL,
  end_date DATE,
  next_service_date DATE,
  price DECIMAL(12, 2) NOT NULL DEFAULT 0,
  billing_frequency VARCHAR(50) CHECK (billing_frequency IN ('per_service', 'monthly', 'annually')),
  auto_invoice BOOLEAN DEFAULT false,
  job_template_id UUID REFERENCES job_templates(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_service_agreements_user ON service_agreements(user_id);
CREATE INDEX idx_service_agreements_contact ON service_agreements(contact_id);
CREATE INDEX idx_service_agreements_status ON service_agreements(status);
CREATE INDEX idx_service_agreements_next_service ON service_agreements(next_service_date);

CREATE TRIGGER update_service_agreements_updated_at BEFORE UPDATE ON service_agreements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Quote items table (for detailed quotes)
CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12, 2) NOT NULL DEFAULT 0,
  item_type VARCHAR(50) DEFAULT 'material' CHECK (item_type IN ('material', 'labor', 'service', 'other')),
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quote_items_job ON quote_items(job_id);

-- Quote status extension (add quote status to jobs)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quote_status VARCHAR(50) DEFAULT NULL CHECK (quote_status IN ('draft', 'sent', 'approved', 'declined', 'expired'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quote_sent_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quote_approved_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quote_declined_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quote_expires_at DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quote_total DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_notes TEXT;
