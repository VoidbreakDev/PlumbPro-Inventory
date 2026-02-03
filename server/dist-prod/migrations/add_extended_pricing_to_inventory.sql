-- Extended Pricing Fields Migration
-- Adds buy/sell pricing fields with GST inclusive/exclusive options

-- Add new pricing columns to inventory_items table
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS buy_price_excl_gst DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS buy_price_incl_gst DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS sell_price_excl_gst DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS sell_price_incl_gst DECIMAL(10, 2);

-- Add comments to document the fields
COMMENT ON COLUMN inventory_items.price IS 'Legacy field - buying price excluding GST (deprecated, use buy_price_excl_gst)';
COMMENT ON COLUMN inventory_items.buy_price_excl_gst IS 'Cost price excluding 10% GST';
COMMENT ON COLUMN inventory_items.buy_price_incl_gst IS 'Cost price including 10% GST';
COMMENT ON COLUMN inventory_items.sell_price_excl_gst IS 'Invoice/CMP price excluding 10% GST';
COMMENT ON COLUMN inventory_items.sell_price_incl_gst IS 'Invoice/CMP price including 10% GST';

-- Optional: Create indexes for pricing queries
CREATE INDEX IF NOT EXISTS idx_inventory_buy_price_excl ON inventory_items(buy_price_excl_gst) WHERE buy_price_excl_gst IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_sell_price_excl ON inventory_items(sell_price_excl_gst) WHERE sell_price_excl_gst IS NOT NULL;
