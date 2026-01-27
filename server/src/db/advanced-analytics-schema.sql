-- Advanced Analytics Schema
-- Phase 3: Reporting, custom reports, and scheduled reports

-- Custom saved reports
CREATE TABLE IF NOT EXISTS saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Report metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  report_type VARCHAR(100) NOT NULL
    CHECK (report_type IN (
      'job_profitability', 'inventory_turnover', 'customer_lifetime_value',
      'material_waste', 'labor_efficiency', 'seasonal_trends',
      'supplier_performance', 'stock_valuation', 'sales_summary',
      'payment_aging', 'custom'
    )),

  -- Configuration
  config JSONB NOT NULL DEFAULT '{}',
  -- Example config:
  -- {
  --   "dateRange": { "type": "relative", "value": "last_90_days" },
  --   "groupBy": ["month", "category"],
  --   "filters": { "status": ["completed"], "customer_type": ["commercial"] },
  --   "metrics": ["revenue", "profit_margin", "job_count"],
  --   "chartType": "bar",
  --   "columns": ["date", "customer", "revenue", "cost", "margin"]
  -- }

  -- Display settings
  chart_type VARCHAR(50) DEFAULT 'table',
  is_favorite BOOLEAN DEFAULT false,
  is_shared BOOLEAN DEFAULT false,

  -- Timestamps
  last_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, name)
);

-- Scheduled report configurations
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  saved_report_id UUID NOT NULL REFERENCES saved_reports(id) ON DELETE CASCADE,

  -- Schedule settings
  frequency VARCHAR(50) NOT NULL
    CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly')),
  day_of_week INTEGER,  -- 0-6 for weekly
  day_of_month INTEGER,  -- 1-31 for monthly
  time_of_day TIME DEFAULT '08:00:00',
  timezone VARCHAR(100) DEFAULT 'Australia/Sydney',

  -- Delivery settings
  delivery_method VARCHAR(50) NOT NULL DEFAULT 'email'
    CHECK (delivery_method IN ('email', 'download', 'both')),
  recipients TEXT[],  -- Array of email addresses
  export_format VARCHAR(20) DEFAULT 'pdf'
    CHECK (export_format IN ('pdf', 'csv', 'xlsx')),
  include_charts BOOLEAN DEFAULT true,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_sent_at TIMESTAMP,
  next_run_at TIMESTAMP,
  failure_count INTEGER DEFAULT 0,
  last_error TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Report execution history
CREATE TABLE IF NOT EXISTS report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  saved_report_id UUID REFERENCES saved_reports(id) ON DELETE SET NULL,
  scheduled_report_id UUID REFERENCES scheduled_reports(id) ON DELETE SET NULL,

  -- Execution details
  report_type VARCHAR(100) NOT NULL,
  config JSONB NOT NULL,
  execution_time_ms INTEGER,
  row_count INTEGER,

  -- Results storage (for caching)
  results_hash VARCHAR(64),  -- SHA-256 of results for cache validation
  cached_results JSONB,
  cache_expires_at TIMESTAMP,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  error_message TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Analytics snapshots for historical trending
CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Snapshot period
  snapshot_date DATE NOT NULL,
  period_type VARCHAR(20) NOT NULL
    CHECK (period_type IN ('daily', 'weekly', 'monthly')),

  -- Business metrics
  total_jobs INTEGER DEFAULT 0,
  completed_jobs INTEGER DEFAULT 0,
  total_revenue DECIMAL(14, 2) DEFAULT 0,
  total_cost DECIMAL(14, 2) DEFAULT 0,
  gross_profit DECIMAL(14, 2) DEFAULT 0,
  profit_margin DECIMAL(5, 2),

  -- Inventory metrics
  inventory_value DECIMAL(14, 2) DEFAULT 0,
  items_below_reorder INTEGER DEFAULT 0,
  stock_movements INTEGER DEFAULT 0,
  turnover_rate DECIMAL(8, 4),

  -- Customer metrics
  new_customers INTEGER DEFAULT 0,
  active_customers INTEGER DEFAULT 0,
  total_invoices INTEGER DEFAULT 0,
  paid_invoices INTEGER DEFAULT 0,
  outstanding_amount DECIMAL(14, 2) DEFAULT 0,

  -- Supplier metrics
  purchase_orders INTEGER DEFAULT 0,
  po_value DECIMAL(14, 2) DEFAULT 0,
  avg_delivery_time_days DECIMAL(5, 2),

  -- Labor metrics
  total_labor_hours DECIMAL(10, 2),
  billable_hours DECIMAL(10, 2),
  labor_efficiency DECIMAL(5, 2),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, snapshot_date, period_type)
);

-- Dashboard widgets configuration
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Widget config
  widget_type VARCHAR(100) NOT NULL,
  title VARCHAR(255),
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 1,
  height INTEGER NOT NULL DEFAULT 1,

  -- Settings
  config JSONB NOT NULL DEFAULT '{}',
  is_visible BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_reports_user ON saved_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_type ON saved_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_saved_reports_favorite ON saved_reports(user_id, is_favorite);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_user ON scheduled_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON scheduled_reports(next_run_at) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_report_executions_user ON report_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_report ON report_executions(saved_report_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_status ON report_executions(status);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_user ON analytics_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_date ON analytics_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_period ON analytics_snapshots(user_id, period_type, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_user ON dashboard_widgets(user_id);

-- Trigger for updating timestamps
CREATE OR REPLACE FUNCTION update_saved_reports_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_saved_reports_timestamp_trigger ON saved_reports;
CREATE TRIGGER update_saved_reports_timestamp_trigger
  BEFORE UPDATE ON saved_reports
  FOR EACH ROW EXECUTE FUNCTION update_saved_reports_timestamp();

DROP TRIGGER IF EXISTS update_scheduled_reports_timestamp_trigger ON scheduled_reports;
CREATE TRIGGER update_scheduled_reports_timestamp_trigger
  BEFORE UPDATE ON scheduled_reports
  FOR EACH ROW EXECUTE FUNCTION update_saved_reports_timestamp();

-- Function to calculate next run time for scheduled reports
CREATE OR REPLACE FUNCTION calc_next_report_run(
  p_frequency VARCHAR(50),
  p_day_of_week INTEGER,
  p_day_of_month INTEGER,
  p_time_of_day TIME,
  p_timezone VARCHAR(100)
)
RETURNS TIMESTAMP AS $$
DECLARE
  v_now TIMESTAMP;
  v_next TIMESTAMP;
BEGIN
  v_now := CURRENT_TIMESTAMP AT TIME ZONE p_timezone;

  CASE p_frequency
    WHEN 'daily' THEN
      v_next := DATE_TRUNC('day', v_now) + p_time_of_day;
      IF v_next <= v_now THEN
        v_next := v_next + INTERVAL '1 day';
      END IF;

    WHEN 'weekly' THEN
      v_next := DATE_TRUNC('week', v_now) + (p_day_of_week || ' days')::INTERVAL + p_time_of_day;
      IF v_next <= v_now THEN
        v_next := v_next + INTERVAL '1 week';
      END IF;

    WHEN 'biweekly' THEN
      v_next := DATE_TRUNC('week', v_now) + (p_day_of_week || ' days')::INTERVAL + p_time_of_day;
      IF v_next <= v_now THEN
        v_next := v_next + INTERVAL '2 weeks';
      END IF;

    WHEN 'monthly' THEN
      v_next := DATE_TRUNC('month', v_now) + ((p_day_of_month - 1) || ' days')::INTERVAL + p_time_of_day;
      IF v_next <= v_now THEN
        v_next := v_next + INTERVAL '1 month';
      END IF;

    WHEN 'quarterly' THEN
      v_next := DATE_TRUNC('quarter', v_now) + ((p_day_of_month - 1) || ' days')::INTERVAL + p_time_of_day;
      IF v_next <= v_now THEN
        v_next := v_next + INTERVAL '3 months';
      END IF;
  END CASE;

  RETURN v_next AT TIME ZONE p_timezone;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE saved_reports IS 'User-saved custom report configurations';
COMMENT ON TABLE scheduled_reports IS 'Automated report delivery schedules';
COMMENT ON TABLE report_executions IS 'History and cache of report runs';
COMMENT ON TABLE analytics_snapshots IS 'Periodic business metrics snapshots for trending';
COMMENT ON TABLE dashboard_widgets IS 'Custom dashboard widget configurations';
