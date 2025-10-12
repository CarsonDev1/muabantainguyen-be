'use strict';

import { pool } from '../setup/db.js';

/**
 * Get deliveries for a user
 */
async function getUserDeliveries(userId) {
	const result = await pool.query(
		`SELECT 
      d.id,
      d.order_item_id,
      d.data,
      d.expires_at,
      d.created_at,
      oi.product_id,
      oi.name as product_name,
      oi.price,
      o.id as order_id,
      o.created_at as order_date
     FROM order_item_deliveries d
     JOIN order_items oi ON oi.id = d.order_item_id
     JOIN orders o ON o.id = oi.order_id
     WHERE o.user_id = $1
       AND d.expires_at > NOW()
     ORDER BY d.created_at DESC`,
		[userId]
	);

	return result.rows;
}

/**
 * Get deliveries for an order
 */
async function getOrderDeliveries(orderId) {
	const result = await pool.query(
		`SELECT 
      d.id,
      d.order_item_id,
      d.data,
      d.expires_at,
      d.created_at,
      oi.product_id,
      oi.name as product_name
     FROM order_item_deliveries d
     JOIN order_items oi ON oi.id = d.order_item_id
     WHERE oi.order_id = $1
     ORDER BY d.created_at DESC`,
		[orderId]
	);

	return result.rows;
}

/**
 * Cleanup expired deliveries
 */
async function cleanupExpiredDeliveries() {
	const result = await pool.query(
		`DELETE FROM order_item_deliveries 
     WHERE expires_at < NOW()
     RETURNING *`
	);

	console.log(`[cleanup] Deleted ${result.rows.length} expired deliveries`);
	return result.rows;
}

/**
 * Get expiring deliveries (for notifications)
 */
async function getExpiringDeliveries(daysThreshold = 3) {
	const result = await pool.query(
		`SELECT 
      d.*,
      o.user_id,
      oi.name as product_name
     FROM order_item_deliveries d
     JOIN order_items oi ON oi.id = d.order_item_id
     JOIN orders o ON o.id = oi.order_id
     WHERE d.expires_at > NOW()
       AND d.expires_at < NOW() + INTERVAL '${daysThreshold} days'
     ORDER BY d.expires_at ASC`
	);

	return result.rows;
}

export { getUserDeliveries, getOrderDeliveries, cleanupExpiredDeliveries, getExpiringDeliveries };
