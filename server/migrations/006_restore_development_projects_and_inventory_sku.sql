-- ============================================================================
-- Migration 006: Restore development project schema and inventory SKU parity
-- ============================================================================
-- Description: Safely adds the development project tables/columns expected by
--              the current routes and aligns PostgreSQL inventory_items with
--              the SKU field already expected by smart ordering and SQLite.
-- ============================================================================

BEGIN;

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS sku VARCHAR(100);

UPDATE inventory_items
SET sku = supplier_code
WHERE (sku IS NULL OR sku = '')
  AND supplier_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory_items(sku)
WHERE sku IS NOT NULL;

CREATE TABLE IF NOT EXISTS development_projects (
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

CREATE INDEX IF NOT EXISTS idx_development_projects_user_id ON development_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_development_projects_customer_id ON development_projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_development_projects_status ON development_projects(overall_status);

CREATE TABLE IF NOT EXISTS development_stages (
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

CREATE INDEX IF NOT EXISTS idx_development_stages_user_id ON development_stages(user_id);
CREATE INDEX IF NOT EXISTS idx_development_stages_project_id ON development_stages(project_id);
CREATE INDEX IF NOT EXISTS idx_development_stages_status ON development_stages(status);
CREATE INDEX IF NOT EXISTS idx_development_stages_planned_date ON development_stages(planned_date);

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS development_project_id UUID,
  ADD COLUMN IF NOT EXISTS development_stage_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_development_project_id_fkey'
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_development_project_id_fkey
      FOREIGN KEY (development_project_id)
      REFERENCES development_projects(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_development_stage_id_fkey'
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT jobs_development_stage_id_fkey
      FOREIGN KEY (development_stage_id)
      REFERENCES development_stages(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_development_project_id ON jobs(development_project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_development_stage_id_unique
  ON jobs(development_stage_id)
  WHERE development_stage_id IS NOT NULL;

COMMIT;
