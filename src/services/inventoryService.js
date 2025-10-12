'use strict';

import {
	addInventoryItem,
	bulkAddInventoryItems,
	getInventoryByProduct,
	deleteInventoryItem,
	getInventoryStats,
	getExpiringInventory,
} from '../models/inventoryModel.js';
import { generateBatchId } from '../utils/inventoryHelpers.js';

/**
 * Add a single inventory item with validation
 */
async function createInventoryItem(data) {
	const { productId, secretData } = data;

	if (!productId || !secretData) {
		throw new Error('Product ID and secret data are required');
	}

	if (secretData.length < 10) {
		throw new Error('Secret data too short (minimum 10 characters)');
	}

	return await addInventoryItem(data);
}

/**
 * Bulk import inventory items
 */
async function importInventoryItems(productId, items) {
	if (!Array.isArray(items) || items.length === 0) {
		throw new Error('Items must be a non-empty array');
	}

	const batchId = generateBatchId();

	const processedItems = items.map((item) => {
		if (typeof item === 'string') {
			return { secretData: item };
		}
		return item;
	});

	const added = await bulkAddInventoryItems(productId, processedItems, batchId);

	return {
		batchId,
		count: added.length,
		items: added,
	};
}

/**
 * Get inventory with filters
 */
async function listInventory(productId, filters = {}) {
	return await getInventoryByProduct(productId, filters);
}

/**
 * Remove inventory item
 */
async function removeInventoryItem(itemId) {
	return await deleteInventoryItem(itemId);
}

/**
 * Get statistics
 */
async function getStats(productId = null) {
	return await getInventoryStats(productId);
}

/**
 * Get items expiring soon
 */
async function getExpiringSoon(days = 7) {
	return await getExpiringInventory(days);
}

export { createInventoryItem, importInventoryItems, listInventory, removeInventoryItem, getStats, getExpiringSoon };
