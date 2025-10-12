-- Migration: Enhance inventory_items table
-- Date: 2025-10-13
-- Description: Add tracking, batch management, and expiry fields

BEGIN;

-- 1. Add new columns to inventory_items
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS batch_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS account_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS source VARCHAR(100) DEFAULT 'manual';

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_batch 
    ON inventory_items(batch_id);

CREATE INDEX IF NOT EXISTS idx_inventory_account_expires 
    ON inventory_items(account_expires_at) 
    WHERE account_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_available 
    ON inventory_items(product_id, is_sold) 
    WHERE is_sold = FALSE;

CREATE INDEX IF NOT EXISTS idx_inventory_sold_at 
    ON inventory_items(sold_at) 
    WHERE sold_at IS NOT NULL;

-- 3. Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_inventory_updated_at ON inventory_items;
CREATE TRIGGER trigger_inventory_updated_at
BEFORE UPDATE ON inventory_items
FOR EACH ROW EXECUTE FUNCTION update_inventory_updated_at();

-- 4. Add validation constraint
ALTER TABLE inventory_items 
DROP CONSTRAINT IF EXISTS check_sold_consistency;

ALTER TABLE inventory_items
ADD CONSTRAINT check_sold_consistency 
CHECK (
    (is_sold = FALSE AND sold_at IS NULL AND order_item_id IS NULL) 
    OR 
    (is_sold = TRUE AND sold_at IS NOT NULL AND order_item_id IS NOT NULL)
);

-- 5. Create function to auto-update product stock
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Update stock count for the affected product
    UPDATE products 
    SET stock = (
        SELECT COUNT(*) 
        FROM inventory_items 
        WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) 
        AND is_sold = FALSE
        AND (account_expires_at IS NULL OR account_expires_at > NOW())
    )
    WHERE id = COALESCE(NEW.product_id, OLD.product_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_product_stock ON inventory_items;
CREATE TRIGGER trigger_update_product_stock
AFTER INSERT OR UPDATE OR DELETE ON inventory_items
FOR EACH ROW EXECUTE FUNCTION update_product_stock();

-- 6. Update existing data
UPDATE inventory_items 
SET account_expires_at = created_at + INTERVAL '12 months',
    batch_id = 'INITIAL-BATCH',
    source = 'migration'
WHERE account_expires_at IS NULL;

-- 7. Create view for available inventory
CREATE OR REPLACE VIEW v_available_inventory AS
SELECT 
    i.*,
    p.name as product_name,
    p.slug as product_slug,
    p.price as selling_price,
    (p.price - i.cost_price) as profit_margin,
    CASE 
        WHEN i.account_expires_at IS NULL THEN 'lifetime'
        WHEN i.account_expires_at > NOW() + INTERVAL '30 days' THEN 'healthy'
        WHEN i.account_expires_at > NOW() THEN 'expiring_soon'
        ELSE 'expired'
    END as account_status
FROM inventory_items i
JOIN products p ON p.id = i.product_id
WHERE i.is_sold = FALSE
  AND (i.account_expires_at IS NULL OR i.account_expires_at > NOW())
ORDER BY i.created_at DESC;

-- 8. Create view for inventory statistics
CREATE OR REPLACE VIEW v_inventory_stats AS
SELECT 
    p.id as product_id,
    p.name as product_name,
    p.slug as product_slug,
    COUNT(i.id) as total_items,
    COUNT(CASE WHEN i.is_sold = FALSE THEN 1 END) as available_items,
    COUNT(CASE WHEN i.is_sold = TRUE THEN 1 END) as sold_items,
    COUNT(CASE WHEN i.account_expires_at > NOW() AND i.account_expires_at < NOW() + INTERVAL '7 days' THEN 1 END) as expiring_soon,
    MIN(i.created_at) as oldest_item_date,
    MAX(i.created_at) as newest_item_date,
    SUM(CASE WHEN i.is_sold = TRUE THEN i.cost_price ELSE 0 END) as total_cost,
    SUM(CASE WHEN i.is_sold = TRUE THEN p.price ELSE 0 END) as total_revenue
FROM products p
LEFT JOIN inventory_items i ON i.product_id = p.id
GROUP BY p.id, p.name, p.slug
ORDER BY available_items DESC;

COMMIT;

-- Verify migration
SELECT 'Migration completed successfully' as status;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'inventory_items' 
ORDER BY ordinal_position;