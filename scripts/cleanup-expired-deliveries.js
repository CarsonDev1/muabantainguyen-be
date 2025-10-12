'use strict';

import { pool } from '../src/setup/db.js';
import { cleanupExpiredDeliveries } from '../src/models/deliveryModel.js';

async function runCleanup() {
	try {
		console.log('🧹 Starting cleanup of expired deliveries...');

		const deleted = await cleanupExpiredDeliveries();

		console.log(`✅ Cleanup completed. Deleted ${deleted.length} expired deliveries.`);

		if (deleted.length > 0) {
			console.log('\nDeleted deliveries:');
			deleted.forEach((d) => {
				console.log(`  - Order Item: ${d.order_item_id}, Expired: ${d.expires_at}`);
			});
		}
	} catch (error) {
		console.error('❌ Cleanup error:', error);
		throw error;
	} finally {
		await pool.end();
	}
}

runCleanup()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
