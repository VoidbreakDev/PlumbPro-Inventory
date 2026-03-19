-- PlumbPro compatibility bridge
-- Forward-only additive migration for older local databases.
-- This aligns the live schema with the route layer without dropping data.

-- Jobs: legacy portal and quote workflows expect quote metadata on jobs.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quote_status VARCHAR(50)
  CHECK (quote_status IN ('draft', 'sent', 'approved', 'declined', 'expired'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quote_sent_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quote_approved_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quote_declined_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quote_expires_at DATE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quote_total DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_notes TEXT;

-- Quotes: bridge quote_items to the job-centric portal queries.
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE CASCADE;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE quote_items qi
SET description = COALESCE(qi.description, qi.item_description, qi.item_name)
WHERE qi.description IS NULL;

UPDATE quote_items qi
SET job_id = q.job_id
FROM quotes q
WHERE qi.quote_id = q.id
  AND qi.job_id IS NULL
  AND q.job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quote_items_job_id ON quote_items(job_id);

-- Backfill job quote summary from the latest linked quote.
WITH latest_quotes AS (
  SELECT DISTINCT ON (q.job_id)
    q.job_id,
    CASE q.status
      WHEN 'rejected' THEN 'declined'
      WHEN 'converted' THEN 'approved'
      ELSE q.status
    END AS mapped_status,
    q.sent_at,
    q.approved_at,
    q.responded_at,
    q.valid_until,
    q.total,
    q.customer_notes
  FROM quotes q
  WHERE q.job_id IS NOT NULL
  ORDER BY q.job_id, q.updated_at DESC, q.created_at DESC
)
UPDATE jobs j
SET quote_status = COALESCE(j.quote_status, lq.mapped_status),
    quote_sent_at = COALESCE(j.quote_sent_at, lq.sent_at),
    quote_approved_at = COALESCE(j.quote_approved_at, CASE WHEN lq.mapped_status = 'approved' THEN lq.approved_at ELSE NULL END),
    quote_declined_at = COALESCE(j.quote_declined_at, CASE WHEN lq.mapped_status = 'declined' THEN lq.responded_at ELSE NULL END),
    quote_expires_at = COALESCE(j.quote_expires_at, lq.valid_until),
    quote_total = COALESCE(NULLIF(j.quote_total, 0), lq.total, 0),
    customer_notes = COALESCE(j.customer_notes, lq.customer_notes)
FROM latest_quotes lq
WHERE j.id = lq.job_id;

-- Invoices: bridge to the API shape used by the current route layer.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS issue_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS total_amount DECIMAL(12, 2) DEFAULT 0;

UPDATE invoices
SET contact_id = customer_id
WHERE contact_id IS NULL
  AND customer_id IS NOT NULL;

UPDATE invoices
SET issue_date = COALESCE(issue_date, invoice_date)
WHERE issue_date IS NULL;

UPDATE invoices
SET total_amount = COALESCE(NULLIF(total_amount, 0), total, 0)
WHERE total_amount IS NULL OR total_amount = 0;

CREATE INDEX IF NOT EXISTS idx_invoices_contact_id_compat ON invoices(contact_id);

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE invoice_items
SET description = COALESCE(description, item_description, item_name)
WHERE description IS NULL;

-- Payments compatibility: older databases use invoice_payments.
DO $$
BEGIN
  IF to_regclass('public.payments') IS NULL THEN
    EXECUTE $view$
      CREATE VIEW payments AS
      SELECT
        id,
        invoice_id,
        amount,
        payment_date,
        payment_method,
        reference_number AS reference
      FROM invoice_payments
    $view$;
  END IF;
END $$;

-- Portal support objects.
CREATE TABLE IF NOT EXISTS customer_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_portal_tokens_contact ON customer_portal_tokens(contact_id);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_token ON customer_portal_tokens(token);

-- Email queue compatibility for the scheduled processor.
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3;
ALTER TABLE email_queue ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
