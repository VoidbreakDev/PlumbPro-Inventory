-- API Access Schema
-- Business Tier: API keys, rate limiting, webhooks

-- API Keys for external integrations
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Key details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  key_hash VARCHAR(255) NOT NULL,  -- SHA-256 hash of the API key
  key_prefix VARCHAR(12) NOT NULL,  -- First 8 chars for identification (e.g., "pp_live_ab12")

  -- Permissions
  scopes TEXT[] NOT NULL DEFAULT '{}',  -- Array of permitted scopes
  -- Available scopes:
  -- 'inventory:read', 'inventory:write'
  -- 'jobs:read', 'jobs:write'
  -- 'contacts:read', 'contacts:write'
  -- 'quotes:read', 'quotes:write'
  -- 'invoices:read', 'invoices:write'
  -- 'purchase_orders:read', 'purchase_orders:write'
  -- 'reports:read'
  -- 'webhooks:manage'

  -- Rate limiting
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_day INTEGER DEFAULT 10000,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP,
  last_used_ip VARCHAR(45),

  -- Expiration
  expires_at TIMESTAMP,

  -- Metadata
  environment VARCHAR(20) DEFAULT 'production' CHECK (environment IN ('production', 'test', 'development')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, name)
);

-- API request logs for analytics and debugging
CREATE TABLE IF NOT EXISTS api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Request details
  method VARCHAR(10) NOT NULL,
  path VARCHAR(500) NOT NULL,
  query_params JSONB,
  request_body_size INTEGER,

  -- Response details
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  response_body_size INTEGER,

  -- Rate limiting info
  rate_limit_remaining INTEGER,
  rate_limit_reset_at TIMESTAMP,

  -- Client info
  ip_address VARCHAR(45),
  user_agent TEXT,

  -- Error info (if any)
  error_code VARCHAR(100),
  error_message TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rate limit tracking (in-memory would be better, but this works for persistence)
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,

  -- Minute window
  minute_window TIMESTAMP NOT NULL,
  minute_count INTEGER DEFAULT 0,

  -- Day window
  day_window DATE NOT NULL,
  day_count INTEGER DEFAULT 0,

  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(api_key_id, minute_window, day_window)
);

-- Webhooks configuration
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Webhook details
  name VARCHAR(255) NOT NULL,
  description TEXT,
  url VARCHAR(2048) NOT NULL,

  -- Events to subscribe to
  events TEXT[] NOT NULL DEFAULT '{}',
  -- Available events:
  -- 'job.created', 'job.updated', 'job.completed', 'job.deleted'
  -- 'quote.created', 'quote.sent', 'quote.accepted', 'quote.rejected'
  -- 'invoice.created', 'invoice.sent', 'invoice.paid', 'invoice.overdue'
  -- 'inventory.low_stock', 'inventory.out_of_stock', 'inventory.adjusted'
  -- 'purchase_order.created', 'purchase_order.sent', 'purchase_order.received'
  -- 'contact.created', 'contact.updated'
  -- 'payment.received'

  -- Security
  secret_hash VARCHAR(255) NOT NULL,  -- For HMAC signature verification

  -- Configuration
  is_active BOOLEAN DEFAULT true,
  retry_on_failure BOOLEAN DEFAULT true,
  max_retries INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 30,

  -- Headers to include
  custom_headers JSONB DEFAULT '{}',

  -- Stats
  last_triggered_at TIMESTAMP,
  last_success_at TIMESTAMP,
  last_failure_at TIMESTAMP,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, name)
);

-- Webhook delivery logs
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,

  -- Event details
  event_type VARCHAR(100) NOT NULL,
  event_id UUID NOT NULL,  -- Reference to the entity that triggered the event
  payload JSONB NOT NULL,

  -- Delivery status
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  attempt_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMP,

  -- Response details
  response_status_code INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,

  -- Error info
  error_message TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP
);

-- API documentation versions (for versioned API)
CREATE TABLE IF NOT EXISTS api_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(20) NOT NULL UNIQUE,
  is_current BOOLEAN DEFAULT false,
  is_deprecated BOOLEAN DEFAULT false,
  deprecation_date DATE,
  sunset_date DATE,
  changelog TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default API version
INSERT INTO api_versions (version, is_current)
VALUES ('v1', true)
ON CONFLICT (version) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_key ON api_request_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_user ON api_request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_created ON api_request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_request_logs_path ON api_request_logs(path);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_key ON api_rate_limits(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_minute ON api_rate_limits(api_key_id, minute_window);

CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at) WHERE status = 'retrying';

-- Trigger for updating timestamps
CREATE OR REPLACE FUNCTION update_api_keys_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_api_keys_timestamp_trigger ON api_keys;
CREATE TRIGGER update_api_keys_timestamp_trigger
  BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_api_keys_timestamp();

DROP TRIGGER IF EXISTS update_webhooks_timestamp_trigger ON webhooks;
CREATE TRIGGER update_webhooks_timestamp_trigger
  BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION update_api_keys_timestamp();

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_api_rate_limit(
  p_api_key_id UUID,
  p_limit_per_minute INTEGER,
  p_limit_per_day INTEGER
)
RETURNS TABLE(allowed BOOLEAN, minute_remaining INTEGER, day_remaining INTEGER, reset_at TIMESTAMP) AS $$
DECLARE
  v_minute_window TIMESTAMP;
  v_day_window DATE;
  v_minute_count INTEGER;
  v_day_count INTEGER;
BEGIN
  v_minute_window := DATE_TRUNC('minute', CURRENT_TIMESTAMP);
  v_day_window := CURRENT_DATE;

  -- Get or create rate limit record
  INSERT INTO api_rate_limits (api_key_id, minute_window, day_window, minute_count, day_count)
  VALUES (p_api_key_id, v_minute_window, v_day_window, 1, 1)
  ON CONFLICT (api_key_id, minute_window, day_window)
  DO UPDATE SET
    minute_count = CASE
      WHEN api_rate_limits.minute_window = v_minute_window THEN api_rate_limits.minute_count + 1
      ELSE 1
    END,
    day_count = CASE
      WHEN api_rate_limits.day_window = v_day_window THEN api_rate_limits.day_count + 1
      ELSE 1
    END,
    minute_window = v_minute_window,
    day_window = v_day_window,
    updated_at = CURRENT_TIMESTAMP
  RETURNING minute_count, day_count INTO v_minute_count, v_day_count;

  RETURN QUERY SELECT
    (v_minute_count <= p_limit_per_minute AND v_day_count <= p_limit_per_day) AS allowed,
    GREATEST(0, p_limit_per_minute - v_minute_count) AS minute_remaining,
    GREATEST(0, p_limit_per_day - v_day_count) AS day_remaining,
    (v_minute_window + INTERVAL '1 minute') AS reset_at;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE api_keys IS 'API keys for external integrations';
COMMENT ON TABLE api_request_logs IS 'Logs of all API requests for analytics';
COMMENT ON TABLE api_rate_limits IS 'Rate limit tracking per API key';
COMMENT ON TABLE webhooks IS 'Webhook configurations for event notifications';
COMMENT ON TABLE webhook_deliveries IS 'Delivery logs for webhook events';
COMMENT ON TABLE api_versions IS 'API version management';
