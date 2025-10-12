'use strict';

import { pool } from '../setup/db.js';

/**
 * Allocate inventory for an order
 * This is called after payment is confirmed
 */
async function allocateInventoryForOrder(orderId) {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		// Get all order items
		const itemsRes = await client.query(
			`SELECT id, product_id, quantity, price 
       FROM order_items 
       WHERE order_id = $1`,
			[orderId]
		);

		console.log(`[inventory] Processing ${itemsRes.rows.length} items for order ${orderId}`);

		for (const orderItem of itemsRes.rows) {
			const { id: orderItemId, product_id, quantity, price } = orderItem;

			// Find available inventory items (not sold, not expired)
			const invRes = await client.query(
				`SELECT id, secret_data, cost_price, batch_id
         FROM inventory_items 
         WHERE product_id = $1 
           AND is_sold = FALSE 
           AND (account_expires_at IS NULL OR account_expires_at > NOW())
         ORDER BY created_at ASC
         LIMIT $2
         FOR UPDATE SKIP LOCKED`,
				[product_id, quantity]
			);

			// Check if we have enough inventory
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
           SET is_sold = TRUE, 
               sold_at = NOW(), 
               order_item_id = $2 
           WHERE id = $1`,
					[inv.id, orderItemId]
				);

				// Create delivery record (30 days expiry from now)
				await client.query(
					`INSERT INTO order_item_deliveries (order_item_id, data, expires_at) 
           VALUES ($1, $2, NOW() + INTERVAL '30 days')`,
					[orderItemId, inv.secret_data]
				);

				console.log(`[inventory] Allocated inventory ${inv.id} to order_item ${orderItemId}`);
			}
		}

		await client.query('COMMIT');
		console.log(`[inventory] Order ${orderId} fulfilled successfully`);
	} catch (error) {
		await client.query('ROLLBACK');
		console.error(`[inventory] Rollback for order ${orderId}:`, error.message);
		throw error;
	} finally {
		client.release();
	}
}

/**
 * Add single inventory item
 */
async function addInventoryItem(data) {
	const {
		productId,
		secretData,
		batchId = null,
		notes = null,
		accountExpiresAt = null,
		costPrice = 0,
		source = 'manual',
	} = data;

	const result = await pool.query(
		`INSERT INTO inventory_items (
      product_id, secret_data, batch_id, notes, 
      account_expires_at, cost_price, source, is_sold
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
    RETURNING *`,
		[productId, secretData, batchId, notes, accountExpiresAt, costPrice, source]
	);

	return result.rows[0];
}

/**
 * Bulk add inventory items
 */
async function bulkAddInventoryItems(productId, items, batchId = null) {
	const client = await pool.connect();

	try {
		await client.query('BEGIN');

		const addedItems = [];

		for (const item of items) {
			const result = await client.query(
				`INSERT INTO inventory_items (
          product_id, secret_data, batch_id, notes,
          account_expires_at, cost_price, source, is_sold
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
        RETURNING *`,
				[
					productId,
					item.secretData,
					batchId || item.batchId,
					item.notes || null,
					item.accountExpiresAt || null,
					item.costPrice || 0,
					item.source || 'bulk_import',
				]
			);

			addedItems.push(result.rows[0]);
		}

		await client.query('COMMIT');

		console.log(`[inventory] Bulk added ${addedItems.length} items to product ${productId}`);

		return addedItems;
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

/**
 * Get inventory items for a product
 */
async function getInventoryByProduct(productId, options = {}) {
	const { showSold = true, showExpired = false, limit = 100, offset = 0 } = options;

	let query = `
    SELECT i.*, p.name as product_name, p.price as selling_price
    FROM inventory_items i
    JOIN products p ON p.id = i.product_id
    WHERE i.product_id = $1
  `;

	const params = [productId];
	let paramIndex = 2;

	if (!showSold) {
		query += ` AND i.is_sold = FALSE`;
	}

	if (!showExpired) {
		query += ` AND (i.account_expires_at IS NULL OR i.account_expires_at > NOW())`;
	}

	query += ` ORDER BY i.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
	params.push(limit, offset);

	const result = await pool.query(query, params);
	return result.rows;
}

/**
 * Get available inventory count
 */
async function getAvailableInventoryCount(productId) {
	const result = await pool.query(
		`SELECT COUNT(*) as count
     FROM inventory_items
     WHERE product_id = $1
       AND is_sold = FALSE
       AND (account_expires_at IS NULL OR account_expires_at > NOW())`,
		[productId]
	);

	return parseInt(result.rows[0].count);
}

/**
 * Delete inventory item (only if not sold)
 */
async function deleteInventoryItem(itemId) {
	const result = await pool.query(
		`DELETE FROM inventory_items 
     WHERE id = $1 AND is_sold = FALSE
     RETURNING *`,
		[itemId]
	);

	if (result.rows.length === 0) {
		throw new Error('Cannot delete sold inventory or item not found');
	}

	return result.rows[0];
}

/**
 * Get inventory statistics
 */
async function getInventoryStats(productId = null) {
	let query = `SELECT * FROM v_inventory_stats`;
	const params = [];

	if (productId) {
		query += ` WHERE product_id = $1`;
		params.push(productId);
	}

	const result = await pool.query(query, params);
	return productId ? result.rows[0] : result.rows;
}

/**
 * Get expiring inventory
 */
async function getExpiringInventory(daysThreshold = 7) {
	const result = await pool.query(
		`SELECT i.*, p.name as product_name
     FROM inventory_items i
     JOIN products p ON p.id = i.product_id
     WHERE i.is_sold = FALSE
       AND i.account_expires_at IS NOT NULL
       AND i.account_expires_at > NOW()
       AND i.account_expires_at < NOW() + INTERVAL '${daysThreshold} days'
     ORDER BY i.account_expires_at ASC`
	);

	return result.rows;
}

/**
 * Mark inventory as refunded (make available again)
 */
async function refundInventory(orderItemId) {
	const result = await pool.query(
		`UPDATE inventory_items 
     SET is_sold = FALSE, 
         sold_at = NULL, 
         order_item_id = NULL,
         notes = CONCAT(COALESCE(notes, ''), ' [REFUNDED: ', NOW(), ']')
     WHERE order_item_id = $1
     RETURNING *`,
		[orderItemId]
	);

	return result.rows;
}

export {
	allocateInventoryForOrder,
	addInventoryItem,
	bulkAddInventoryItems,
	getInventoryByProduct,
	getAvailableInventoryCount,
	deleteInventoryItem,
	getInventoryStats,
	getExpiringInventory,
	refundInventory,
};
