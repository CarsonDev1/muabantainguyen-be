'use strict';

import { pool } from '../setup/db.js';

async function allocateInventoryForOrder(orderId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const itemsRes = await client.query(`SELECT id FROM order_items WHERE order_id = $1`, [orderId]);
    for (const row of itemsRes.rows) {
      const oi = row.id;
      // Find free inventory item for this order_item's product
      const productRes = await client.query(`SELECT product_id, quantity FROM order_items WHERE id = $1`, [oi]);
      const { product_id, quantity } = productRes.rows[0];
      const invRes = await client.query(
        `SELECT id, secret_data FROM inventory_items WHERE product_id = $1 AND is_sold = FALSE LIMIT $2`,
        [product_id, quantity]
      );
      if (invRes.rows.length < quantity) throw new Error('Insufficient inventory to fulfill order');
      for (let i = 0; i < quantity; i++) {
        const inv = invRes.rows[i];
        await client.query(
          `UPDATE inventory_items SET is_sold = TRUE, sold_at = NOW(), order_item_id = $2 WHERE id = $1`,
          [inv.id, oi]
        );
        // Create delivery record with 30 days expiry
        await client.query(
          `INSERT INTO order_item_deliveries (order_item_id, data, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
          [oi, inv.secret_data]
        );
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function listDeliveries(userId, { page = 1, pageSize = 20 }) {
  const offset = (page - 1) * pageSize;
  const { rows } = await pool.query(
    `SELECT d.id, d.order_item_id, d.data, d.expires_at, o.id as order_id, o.created_at
     FROM order_item_deliveries d
     JOIN order_items oi ON oi.id = d.order_item_id
     JOIN orders o ON o.id = oi.order_id
     WHERE o.user_id = $1
     ORDER BY d.created_at DESC LIMIT $2 OFFSET $3`,
    [userId, pageSize, offset]
  );
  return rows;
}

async function cleanupExpiredDeliveries() {
  await pool.query(`DELETE FROM order_item_deliveries WHERE expires_at < NOW()`);
}

export { allocateInventoryForOrder, listDeliveries, cleanupExpiredDeliveries };

