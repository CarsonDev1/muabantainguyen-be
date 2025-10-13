'use strict';

/**
 * Generate unique batch ID
 */
function generateBatchId() {
	const date = new Date();
	const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
	const timeStr = date.getTime().toString().slice(-6);
	const random = Math.random().toString(36).substring(2, 6).toUpperCase();

	return `BATCH-${dateStr}-${timeStr}-${random}`;
}

/**
 * Parse bulk inventory text
 */
function parseBulkInventoryText(text) {
	let items = text.split(/\n---\n/).filter((item) => item.trim());

	if (items.length === 1) {
		items = text.split(/\n\n+/).filter((item) => item.trim());
	}

	return items.map((item) => item.trim());
}

/**
 * Validate secret data format
 */
function validateSecretData(data) {
	if (!data || typeof data !== 'string') {
		return { valid: false, error: 'Data must be a non-empty string' };
	}

	if (data.length < 10) {
		return { valid: false, error: 'Data too short (minimum 10 characters)' };
	}

	if (data.length > 10000) {
		return { valid: false, error: 'Data too long (maximum 10000 characters)' };
	}

	return { valid: true };
}

/**
 * Calculate days until expiry
 */
function getDaysUntilExpiry(expiresAt) {
	if (!expiresAt) return null;

	const now = new Date();
	const expiry = new Date(expiresAt);
	const diffTime = expiry.getTime() - now.getTime();
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

	return diffDays;
}

export { generateBatchId, parseBulkInventoryText, validateSecretData, getDaysUntilExpiry };
