'use strict';

import { pool } from '../setup/db.js';

/**
 * Sync product stock with available inventory
 */
async function syncAllProductStocks() {
	try {
		const result = await pool.query(`
      UPDATE products p
      SET stock = (
        SELECT COUNT(*) 
        FROM inventory_items i
        WHERE i.product_id = p.id
          AND i.is_sold = FALSE
          AND (i.account_expires_at IS NULL OR i.account_expires_at > NOW())
      )
      RETURNING id, name, stock
    `);

		console.log(`[stock-sync] Updated stock for ${result.rows.length} products`);
		return result.rows;
	} catch (error) {
		console.error('[stock-sync] Error:', error);
		throw error;
	}
}

/**
 * Sync stock for a specific product
 */
async function syncProductStock(productId) {
	const result = await pool.query(
		`UPDATE products 
     SET stock = (
       SELECT COUNT(*) 
       FROM inventory_items 
       WHERE product_id = $1
         AND is_sold = FALSE
         AND (account_expires_at IS NULL OR account_expires_at > NOW())
     )
     WHERE id = $1
     RETURNING id, name, stock`,
		[productId]
	);

	if (result.rows.length === 0) {
		throw new Error('Product not found');
	}

	console.log(`[stock-sync] Updated stock for ${result.rows[0].name}: ${result.rows[0].stock}`);
	return result.rows[0];
}

export { syncAllProductStocks, syncProductStock };
