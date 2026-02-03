-- ============================================================================
-- Rollback Script for Migration 005: Supplier Management Enhancements
-- ============================================================================
-- Description: Safely rollback the supplier management migration
-- WARNING: This will delete all supplier ratings, delivery tracking, and
--          price alerts. Item-supplier relationships will be preserved in
--          the original inventory_items.supplier_id field.
--
-- Author: Claude Sonnet 4.5
-- Date: 2026-01-12
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Drop Triggers
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_update_supplier_rating ON supplier_ratings;
DROP TRIGGER IF EXISTS trigger_update_item_supplier_stats ON item_suppliers;
DROP TRIGGER IF EXISTS trigger_create_price_alert ON item_suppliers;
DROP TRIGGER IF EXISTS trigger_calculate_delivery_performance ON supplier_delivery_tracking;
DROP TRIGGER IF EXISTS trigger_update_item_supplier_timestamps ON item_suppliers;

-- ============================================================================
-- 2. Drop Functions
-- ============================================================================

DROP FUNCTION IF EXISTS update_supplier_average_rating();
DROP FUNCTION IF EXISTS update_item_supplier_stats();
DROP FUNCTION IF EXISTS create_price_change_alert();
DROP FUNCTION IF EXISTS calculate_delivery_performance();
DROP FUNCTION IF EXISTS update_item_supplier_timestamps();

-- ============================================================================
-- 3. Drop New Tables
-- ============================================================================

DROP TABLE IF EXISTS price_change_alerts CASCADE;
DROP TABLE IF EXISTS supplier_delivery_tracking CASCADE;
DROP TABLE IF EXISTS supplier_ratings CASCADE;
DROP TABLE IF EXISTS item_suppliers CASCADE;

-- ============================================================================
-- 4. Remove Added Columns from Existing Tables
-- ============================================================================

-- Remove columns from inventory_items
ALTER TABLE inventory_items
  DROP COLUMN IF EXISTS lowest_price_supplier_id,
  DROP COLUMN IF EXISTS lowest_unit_price,
  DROP COLUMN IF EXISTS supplier_count;

-- Remove columns from purchase_orders
ALTER TABLE purchase_orders
  DROP COLUMN IF EXISTS tracking_number,
  DROP COLUMN IF EXISTS carrier,
  DROP COLUMN IF EXISTS actual_delivery_date;

-- Remove columns from contacts
ALTER TABLE contacts
  DROP COLUMN IF EXISTS website,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS abn,
  DROP COLUMN IF EXISTS payment_terms,
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS average_rating,
  DROP COLUMN IF EXISTS total_ratings;

-- ============================================================================
-- Rollback Complete
-- ============================================================================

COMMIT;

-- Verification queries (run these manually after rollback)
-- SELECT COUNT(*) FROM item_suppliers;  -- Should error (table doesn't exist)
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name IN ('supplier_count', 'lowest_unit_price');  -- Should return 0 rows
