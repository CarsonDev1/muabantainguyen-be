'use strict';

import { allocateInventoryForOrder } from '../models/inventoryModel.js';

async function fulfillOrder(orderId) {
	try {
		await allocateInventoryForOrder(orderId);
		console.log(`[fulfillment] Order ${orderId} fulfilled successfully`);
	} catch (error) {
		console.error(`[fulfillment] Failed to fulfill order ${orderId}:`, error);
		throw error;
	}
}

export { fulfillOrder };
