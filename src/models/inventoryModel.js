'use strict';

import { pool } from '../setup/db.js';

async function allocateInventoryForOrder(orderId) {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');

		// Get all order items
		const itemsRes = await client.query(`SELECT id, product_id, quantity FROM order_items WHERE order_id = $1`, [
			orderId,
		]);

		console.log(`[inventory] Processing ${itemsRes.rows.length} items for order ${orderId}`);

		for (const row of itemsRes.rows) {
			const { id: orderItemId, product_id, quantity } = row;

			// Find available inventory items
			const invRes = await client.query(
				`SELECT id, secret_data FROM inventory_items 
         WHERE product_id = $1 AND is_sold = FALSE 
         LIMIT $2`,
				[product_id, quantity]
			);

			if (invRes.rows.length < quantity) {
				throw new Error(
					`Insufficient inventory for product ${product_id}. ` +
						`Need ${quantity}, have ${invRes.rows.length}`
				);
			}

			// Allocate each inventory item
			for (let i = 0; i < quantity; i++) {
				const inv = invRes.rows[i];

				// Mark inventory as sold
				await client.query(
					`UPDATE inventory_items 
           SET is_sold = TRUE, sold_at = NOW(), order_item_id = $2 
           WHERE id = $1`,
					[inv.id, orderItemId]
				);

				// Create delivery record (30 days expiry)
				await client.query(
					`INSERT INTO order_item_deliveries (order_item_id, data, expires_at) 
           VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
					[orderItemId, inv.secret_data]
				);

				console.log(`[inventory] Created delivery for order_item ${orderItemId}`);
			}
		}

		await client.query('COMMIT');
		console.log(`[inventory] Order ${orderId} fulfilled successfully`);
	} catch (e) {
		await client.query('ROLLBACK');
		console.error(`[inventory] Rollback for order ${orderId}:`, e.message);
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
