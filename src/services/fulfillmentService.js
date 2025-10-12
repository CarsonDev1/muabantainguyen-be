'use strict';

import { allocateInventoryForOrder } from '../models/inventoryModel.js';

async function fulfillOrder(orderId) {
	try {
		console.log(`[fulfillment] Starting fulfillment for order ${orderId}`);

		await allocateInventoryForOrder(orderId);

		console.log(`[fulfillment] Order ${orderId} fulfilled successfully`);
	} catch (error) {
		console.error(`[fulfillment] Failed to fulfill order ${orderId}:`, error);
		throw error;
	}
}

export { fulfillOrder };
