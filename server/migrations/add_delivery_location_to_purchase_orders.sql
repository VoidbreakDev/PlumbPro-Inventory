-- Add delivery location fields to purchase orders
-- Allows specifying whether items go to warehouse or direct to a job site

-- Add delivery_location column
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS delivery_location VARCHAR(50) DEFAULT 'warehouse' CHECK (delivery_location IN ('warehouse', 'direct_to_site'));

-- Add deliver_to_job_id column (for direct to site deliveries)
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS deliver_to_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_po_deliver_to_job ON purchase_orders(deliver_to_job_id);

-- Remove job_id from purchase_order_items as it's now at PO level
-- (Only if the column exists and is empty/unused)
-- Note: Commenting this out for safety - run manually if needed
-- ALTER TABLE purchase_order_items DROP COLUMN IF EXISTS job_id;

-- Comments for documentation
COMMENT ON COLUMN purchase_orders.delivery_location IS 'Where items should be delivered: warehouse or direct_to_site';
COMMENT ON COLUMN purchase_orders.deliver_to_job_id IS 'Job to deliver to if delivery_location is direct_to_site';
