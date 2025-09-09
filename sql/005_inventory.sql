CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  secret_data TEXT NOT NULL,
  is_sold BOOLEAN NOT NULL DEFAULT FALSE,
  sold_at TIMESTAMPTZ,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_item_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_items(product_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_order_item ON order_item_deliveries(order_item_id);

