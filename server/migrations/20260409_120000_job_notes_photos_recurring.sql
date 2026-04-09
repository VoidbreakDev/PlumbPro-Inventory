-- UP: Job scheduling enhancements
-- Adds scheduled_start/scheduled_end to jobs, extends status values,
-- and creates job_notes, job_photos, job_recurring tables.

-- 1. Add time-block scheduling columns to jobs
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_end   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_start ON jobs(scheduled_start);

-- 2. Extend the status CHECK constraint to include 'On Hold', 'Unscheduled', 'Invoiced'
--    PostgreSQL requires drop + re-add (constraint name is auto-generated as jobs_status_check)
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('Unscheduled', 'Scheduled', 'In Progress', 'On Hold', 'Completed', 'Cancelled', 'Invoiced'));

-- 3. Notes per job
CREATE TABLE IF NOT EXISTS job_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  note        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_notes_job ON job_notes(job_id);

-- 4. Photos per job
CREATE TABLE IF NOT EXISTS job_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  file_path   TEXT NOT NULL,
  caption     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_photos_job ON job_photos(job_id);

-- 5. Recurring job rules
CREATE TABLE IF NOT EXISTS job_recurring (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  frequency       VARCHAR(20) NOT NULL
                    CHECK (frequency IN ('daily','weekly','fortnightly','monthly','quarterly')),
  next_due        DATE NOT NULL,
  last_generated  DATE,
  is_active       BOOLEAN DEFAULT TRUE,
  CONSTRAINT job_recurring_job_id_unique UNIQUE (job_id)
);
CREATE INDEX IF NOT EXISTS idx_job_recurring_next_due ON job_recurring(next_due) WHERE is_active = TRUE;

-- DOWN (commented out — run manually if needed)
-- ALTER TABLE jobs DROP COLUMN IF EXISTS scheduled_start;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS scheduled_end;
-- ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
-- ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
--   CHECK (status IN ('Scheduled', 'In Progress', 'Completed', 'Cancelled'));
-- DROP TABLE IF EXISTS job_recurring;
-- DROP TABLE IF EXISTS job_photos;
-- DROP TABLE IF EXISTS job_notes;
