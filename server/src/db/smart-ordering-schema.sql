-- Smart Ordering System Schema
-- Phase 3: Advanced reorder alerts, usage patterns, and predictive ordering

-- Reorder rules per item
CREATE TABLE IF NOT EXISTS reorder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,

  -- Reorder triggers
  reorder_point INTEGER NOT NULL DEFAULT 0,  -- Alert when quantity <= this
  reorder_quantity INTEGER NOT NULL DEFAULT 1,  -- Suggested order quantity
  max_stock_level INTEGER,  -- Maximum quantity to hold
  min_order_quantity INTEGER DEFAULT 1,  -- Minimum order for this item
  order_multiple INTEGER DEFAULT 1,  -- Order in multiples of this

  -- Lead time settings
  lead_time_days INTEGER DEFAULT 0,  -- Days from order to delivery
  safety_stock_days INTEGER DEFAULT 0,  -- Extra buffer in days of usage

  -- Supplier preference
  preferred_supplier_id UUID REFERENCES contacts(id),

  -- Auto-ordering settings
  auto_order_enabled BOOLEAN DEFAULT false,
  auto_order_supplier_id UUID REFERENCES contacts(id),
  auto_order_approval_required BOOLEAN DEFAULT true,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_alert_at TIMESTAMP,
  last_ordered_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, item_id)
);

-- Usage history for pattern analysis
CREATE TABLE IF NOT EXISTS item_usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,

  -- Period (weekly aggregation)
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Usage metrics
  quantity_used INTEGER NOT NULL DEFAULT 0,
  quantity_ordered INTEGER DEFAULT 0,
  quantity_received INTEGER DEFAULT 0,
  quantity_returned INTEGER DEFAULT 0,

  -- Job metrics
  jobs_count INTEGER DEFAULT 0,
  job_types JSONB,  -- {"Maintenance": 3, "New Construction": 2}

  -- Financial
  total_cost DECIMAL(12, 2) DEFAULT 0,
  avg_unit_cost DECIMAL(10, 2),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, item_id, period_start)
);

-- Reorder alerts (pending actions)
CREATE TABLE IF NOT EXISTS reorder_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,

  -- Alert details
  alert_type VARCHAR(50) NOT NULL
    CHECK (alert_type IN ('low_stock', 'critical_stock', 'upcoming_job_shortage',
                          'lead_time_warning', 'auto_order_suggestion', 'price_drop')),
  priority VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'critical')),

  -- Current state
  current_quantity INTEGER NOT NULL,
  available_quantity INTEGER,
  allocated_quantity INTEGER DEFAULT 0,
  on_order_quantity INTEGER DEFAULT 0,
  reorder_point INTEGER,

  -- Suggestion
  suggested_quantity INTEGER,
  suggested_supplier_id UUID REFERENCES contacts(id),
  estimated_cost DECIMAL(12, 2),
  estimated_delivery_date DATE,

  -- Trigger context
  triggered_by VARCHAR(100),  -- 'stock_movement', 'job_allocation', 'scheduled_check'
  trigger_details JSONB,

  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'acknowledged', 'ordered', 'dismissed', 'auto_resolved')),
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMP,
  resolution_notes TEXT,

  -- Related entities
  purchase_order_id UUID REFERENCES purchase_orders(id),
  job_id UUID REFERENCES jobs(id),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage forecasts (ML predictions stored)
CREATE TABLE IF NOT EXISTS usage_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,

  -- Forecast period
  forecast_date DATE NOT NULL,
  forecast_type VARCHAR(50) NOT NULL DEFAULT 'weekly'
    CHECK (forecast_type IN ('daily', 'weekly', 'monthly')),

  -- Predictions
  predicted_usage INTEGER NOT NULL,
  confidence_level DECIMAL(5, 2),  -- 0-100%
  prediction_range_low INTEGER,
  prediction_range_high INTEGER,

  -- Factors used
  factors_used JSONB,  -- {"historical_avg": 0.6, "job_schedule": 0.3, "seasonality": 0.1}

  -- Accuracy tracking
  actual_usage INTEGER,
  accuracy_score DECIMAL(5, 2),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, item_id, forecast_date, forecast_type)
);

-- Order optimization suggestions
CREATE TABLE IF NOT EXISTS order_optimization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Optimization type
  optimization_type VARCHAR(50) NOT NULL
    CHECK (optimization_type IN ('bulk_discount', 'consolidate_orders', 'timing_optimization',
                                  'supplier_switch', 'alternative_product')),

  -- Items involved
  item_ids UUID[] NOT NULL,
  item_names TEXT[],

  -- Current vs optimized
  current_approach JSONB,
  suggested_approach JSONB,

  -- Savings
  estimated_savings DECIMAL(12, 2),
  savings_type VARCHAR(50),  -- 'cost', 'time', 'frequency'

  -- Status
  status VARCHAR(50) DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  accepted_at TIMESTAMP,
  rejected_at TIMESTAMP,
  rejection_reason TEXT,

  -- Validity
  valid_until DATE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reorder_rules_user ON reorder_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_reorder_rules_item ON reorder_rules(item_id);
CREATE INDEX IF NOT EXISTS idx_reorder_rules_supplier ON reorder_rules(preferred_supplier_id);

CREATE INDEX IF NOT EXISTS idx_usage_history_user_item ON item_usage_history(user_id, item_id);
CREATE INDEX IF NOT EXISTS idx_usage_history_period ON item_usage_history(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_reorder_alerts_user ON reorder_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_reorder_alerts_item ON reorder_alerts(item_id);
CREATE INDEX IF NOT EXISTS idx_reorder_alerts_status ON reorder_alerts(status);
CREATE INDEX IF NOT EXISTS idx_reorder_alerts_priority ON reorder_alerts(priority);

CREATE INDEX IF NOT EXISTS idx_usage_forecasts_user_item ON usage_forecasts(user_id, item_id);
CREATE INDEX IF NOT EXISTS idx_usage_forecasts_date ON usage_forecasts(forecast_date);

-- Function to calculate average daily usage
CREATE OR REPLACE FUNCTION calc_avg_daily_usage(p_user_id UUID, p_item_id UUID, p_days INTEGER DEFAULT 90)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  v_total_usage INTEGER;
  v_days_with_data INTEGER;
BEGIN
  SELECT
    COALESCE(SUM(quantity_used), 0),
    COUNT(DISTINCT period_start)
  INTO v_total_usage, v_days_with_data
  FROM item_usage_history
  WHERE user_id = p_user_id
    AND item_id = p_item_id
    AND period_start >= CURRENT_DATE - p_days;

  IF v_days_with_data = 0 THEN
    RETURN 0;
  END IF;

  RETURN (v_total_usage::DECIMAL / (v_days_with_data * 7))::DECIMAL(10, 2);  -- Weekly periods
END;
$$ LANGUAGE plpgsql;

-- Function to calculate days of stock remaining
CREATE OR REPLACE FUNCTION calc_days_of_stock(p_user_id UUID, p_item_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_current_qty INTEGER;
  v_allocated_qty INTEGER;
  v_available_qty INTEGER;
  v_avg_daily_usage DECIMAL(10, 2);
BEGIN
  -- Get current stock
  SELECT quantity INTO v_current_qty
  FROM inventory_items
  WHERE id = p_item_id AND user_id = p_user_id;

  -- Get allocated stock
  SELECT COALESCE(SUM(quantity), 0) INTO v_allocated_qty
  FROM job_allocated_items jai
  JOIN jobs j ON jai.job_id = j.id
  WHERE jai.item_id = p_item_id
    AND j.status IN ('Scheduled', 'In Progress');

  v_available_qty := GREATEST(v_current_qty - v_allocated_qty, 0);

  -- Get average daily usage
  v_avg_daily_usage := calc_avg_daily_usage(p_user_id, p_item_id, 90);

  IF v_avg_daily_usage <= 0 THEN
    RETURN 999;  -- No usage data, effectively infinite
  END IF;

  RETURN FLOOR(v_available_qty / v_avg_daily_usage);
END;
$$ LANGUAGE plpgsql;

-- Function to suggest optimal order quantity
CREATE OR REPLACE FUNCTION calc_optimal_order_qty(p_user_id UUID, p_item_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_rule RECORD;
  v_avg_daily_usage DECIMAL(10, 2);
  v_days_of_stock INTEGER;
  v_suggested_qty INTEGER;
  v_current_qty INTEGER;
  v_on_order_qty INTEGER;
BEGIN
  -- Get reorder rule if exists
  SELECT * INTO v_rule
  FROM reorder_rules
  WHERE user_id = p_user_id AND item_id = p_item_id AND is_active = true;

  -- Get current stock
  SELECT quantity INTO v_current_qty
  FROM inventory_items WHERE id = p_item_id AND user_id = p_user_id;

  -- Get on order quantity
  SELECT COALESCE(SUM(poi.quantity_ordered - poi.quantity_received), 0) INTO v_on_order_qty
  FROM purchase_order_items poi
  JOIN purchase_orders po ON poi.purchase_order_id = po.id
  WHERE poi.inventory_item_id = p_item_id
    AND po.user_id = p_user_id
    AND po.status IN ('sent', 'confirmed', 'partially_received');

  -- Get average daily usage
  v_avg_daily_usage := calc_avg_daily_usage(p_user_id, p_item_id, 90);

  IF v_rule IS NOT NULL THEN
    -- Use rule-based calculation
    IF v_rule.max_stock_level IS NOT NULL THEN
      v_suggested_qty := GREATEST(
        v_rule.max_stock_level - v_current_qty - v_on_order_qty,
        v_rule.min_order_quantity
      );
    ELSE
      v_suggested_qty := v_rule.reorder_quantity;
    END IF;

    -- Round to order multiple
    IF v_rule.order_multiple > 1 THEN
      v_suggested_qty := CEIL(v_suggested_qty::DECIMAL / v_rule.order_multiple) * v_rule.order_multiple;
    END IF;
  ELSE
    -- Default: Order 30 days of usage + safety stock
    v_suggested_qty := CEIL(v_avg_daily_usage * 30);
    v_suggested_qty := GREATEST(v_suggested_qty, 1);
  END IF;

  RETURN v_suggested_qty;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update reorder rules timestamp
CREATE OR REPLACE FUNCTION update_reorder_rules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_reorder_rules_timestamp_trigger ON reorder_rules;
CREATE TRIGGER update_reorder_rules_timestamp_trigger
  BEFORE UPDATE ON reorder_rules
  FOR EACH ROW EXECUTE FUNCTION update_reorder_rules_timestamp();

-- Trigger to check reorder alerts on stock movement
CREATE OR REPLACE FUNCTION check_reorder_on_stock_change()
RETURNS TRIGGER AS $$
DECLARE
  v_rule RECORD;
  v_available_qty INTEGER;
  v_allocated_qty INTEGER;
  v_on_order_qty INTEGER;
BEGIN
  -- Only check on quantity decrease
  IF NEW.quantity < OLD.quantity OR TG_OP = 'UPDATE' THEN
    -- Get reorder rule
    SELECT * INTO v_rule
    FROM reorder_rules
    WHERE item_id = NEW.id AND user_id = NEW.user_id AND is_active = true;

    IF v_rule IS NOT NULL AND v_rule.reorder_point > 0 THEN
      -- Calculate available quantity
      SELECT COALESCE(SUM(quantity), 0) INTO v_allocated_qty
      FROM job_allocated_items jai
      JOIN jobs j ON jai.job_id = j.id
      WHERE jai.item_id = NEW.id AND j.status IN ('Scheduled', 'In Progress');

      SELECT COALESCE(SUM(poi.quantity_ordered - poi.quantity_received), 0) INTO v_on_order_qty
      FROM purchase_order_items poi
      JOIN purchase_orders po ON poi.purchase_order_id = po.id
      WHERE poi.inventory_item_id = NEW.id
        AND po.user_id = NEW.user_id
        AND po.status IN ('sent', 'confirmed', 'partially_received');

      v_available_qty := NEW.quantity - v_allocated_qty;

      -- Check if below reorder point (considering on-order items)
      IF (v_available_qty + v_on_order_qty) <= v_rule.reorder_point THEN
        -- Check if alert already exists
        IF NOT EXISTS (
          SELECT 1 FROM reorder_alerts
          WHERE item_id = NEW.id
            AND user_id = NEW.user_id
            AND status = 'pending'
            AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
        ) THEN
          -- Create reorder alert
          INSERT INTO reorder_alerts (
            user_id, item_id, alert_type, priority,
            current_quantity, available_quantity, allocated_quantity, on_order_quantity,
            reorder_point, suggested_quantity, suggested_supplier_id,
            triggered_by, trigger_details
          )
          VALUES (
            NEW.user_id, NEW.id,
            CASE WHEN v_available_qty <= 0 THEN 'critical_stock' ELSE 'low_stock' END,
            CASE WHEN v_available_qty <= 0 THEN 'critical' ELSE 'high' END,
            NEW.quantity, v_available_qty, v_allocated_qty, v_on_order_qty,
            v_rule.reorder_point,
            calc_optimal_order_qty(NEW.user_id, NEW.id),
            v_rule.preferred_supplier_id,
            'stock_movement',
            jsonb_build_object('old_quantity', OLD.quantity, 'new_quantity', NEW.quantity)
          );

          -- Update last alert time
          UPDATE reorder_rules
          SET last_alert_at = CURRENT_TIMESTAMP
          WHERE id = v_rule.id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_reorder_on_stock_change_trigger ON inventory_items;
CREATE TRIGGER check_reorder_on_stock_change_trigger
  AFTER UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION check_reorder_on_stock_change();

-- Comments
COMMENT ON TABLE reorder_rules IS 'Per-item reorder settings and automation rules';
COMMENT ON TABLE item_usage_history IS 'Weekly aggregated usage data for pattern analysis';
COMMENT ON TABLE reorder_alerts IS 'Pending reorder actions and notifications';
COMMENT ON TABLE usage_forecasts IS 'AI/ML usage predictions for predictive ordering';
COMMENT ON TABLE order_optimization IS 'Suggested optimizations (bulk discounts, consolidation)';
