'use strict';

import express from 'express';
import { adminOnly } from '../middleware/adminMiddleware.js';
import { pool } from '../setup/db.js';
import {
	createCategoryController,
	updateCategoryController,
	deleteCategoryController,
	getCategoryTreeController,
	getCategoryController,
	getCategoryBySlugController,
} from '../controllers/adminCategoryController.js';
import {
	listUsersController,
	setBlockController,
	userOrdersController,
	listProductsController,
	createProductController,
	updateProductController,
	deleteProductController,
	createVoucherController,
	listVouchersController,
	updateVoucherController,
	deleteVoucherController,
	getProductController,
} from '../controllers/adminController.js';

import {
	listAdminsController,
	createAdminController,
	updateAdminRoleController,
	listRolesController,
	listPermissionsController,
} from '../controllers/adminManagementController.js';

import { getAllSettingsController, updateSettingsController } from '../controllers/siteSettingsController.js';

import { requirePermission } from '../middleware/permissionMiddleware.js';
import { parseBulkInventoryText } from '../utils/inventoryHelpers.js';
import {
	createInventoryItem,
	getExpiringSoon,
	getStats,
	importInventoryItems,
	listInventory,
	removeInventoryItem,
} from '../services/inventoryService.js';
import { syncAllProductStocks, syncProductStock } from '../services/stockSyncService.js';

const router = express.Router();

// Users
router.get('/users', adminOnly, listUsersController);
router.put('/users/:id/block', adminOnly, setBlockController);
router.get('/users/:id/orders', adminOnly, userOrdersController);

// Products
router.get('/products', adminOnly, listProductsController);
router.post('/products', adminOnly, createProductController);
router.put('/products/:id', adminOnly, updateProductController);
router.delete('/products/:id', adminOnly, deleteProductController);
router.get('/products/:id', adminOnly, getProductController);

// Categories CRUD + tree
router.post('/categories', adminOnly, createCategoryController);
router.put('/categories/:id', adminOnly, updateCategoryController);
router.delete('/categories/:id', adminOnly, deleteCategoryController);
router.get('/categories/tree', adminOnly, getCategoryTreeController);
router.get('/categories/:id', adminOnly, getCategoryController);
router.get('/categories/slug/:slug', adminOnly, getCategoryBySlugController);

// Vouchers
router.post('/vouchers', adminOnly, createVoucherController);
router.get('/vouchers', adminOnly, listVouchersController);
router.put('/vouchers/:id', adminOnly, updateVoucherController);
router.delete('/vouchers/:id', adminOnly, deleteVoucherController);

// FAQ CRUD
router.post('/faqs', adminOnly, async (req, res) => {
	const { question, answer, is_active } = req.body;
	const { rows } = await pool.query(
		`INSERT INTO faqs (question, answer, is_active) VALUES ($1, $2, COALESCE($3, TRUE)) RETURNING id`,
		[question, answer, is_active]
	);
	res.status(201).json({ id: rows[0].id });
});
router.put('/faqs/:id', adminOnly, async (req, res) => {
	await pool.query(
		`UPDATE faqs SET question = COALESCE($2, question), answer = COALESCE($3, answer), is_active = COALESCE($4, is_active) WHERE id = $1`,
		[req.params.id, req.body.question || null, req.body.answer || null, req.body.is_active]
	);
	res.json({ success: true });
});
router.delete('/faqs/:id', adminOnly, async (req, res) => {
	await pool.query(`DELETE FROM faqs WHERE id = $1`, [req.params.id]);
	res.json({ success: true });
});

// Announcements CRUD
router.get('/announcements', adminOnly, async (req, res) => {
	const { rows } = await pool.query(
		`SELECT id, title, content, image, is_active, created_at 
     FROM announcements 
     ORDER BY created_at DESC`
	);
	res.json({ announcements: rows });
});

router.post('/announcements', adminOnly, async (req, res) => {
	const { title, content, is_active, image } = req.body;
	const { rows } = await pool.query(
		`INSERT INTO announcements (title, content, is_active, image) 
     VALUES ($1, $2, COALESCE($3, TRUE), $4) 
     RETURNING id`,
		[title, content, is_active, image]
	);
	res.status(201).json({ id: rows[0].id });
});

router.put('/announcements/:id', adminOnly, async (req, res) => {
	await pool.query(
		`UPDATE announcements 
     SET title = COALESCE($2, title), 
         content = COALESCE($3, content), 
         is_active = COALESCE($4, is_active),
         image = COALESCE($5, image)
     WHERE id = $1`,
		[req.params.id, req.body.title || null, req.body.content || null, req.body.is_active, req.body.image || null]
	);
	res.json({ success: true });
});

router.delete('/announcements/:id', adminOnly, async (req, res) => {
	await pool.query(`DELETE FROM announcements WHERE id = $1`, [req.params.id]);
	res.json({ success: true });
});

// Site settings
router.get('/settings', adminOnly, async (req, res) => {
	const { rows } = await pool.query(`SELECT key, value FROM site_settings`);
	res.json({ settings: rows });
});
router.put('/settings', adminOnly, async (req, res) => {
	const entries = Object.entries(req.body || {});
	for (const [key, value] of entries) {
		await pool.query(
			`INSERT INTO site_settings (key, value) VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
			[key, String(value)]
		);
	}
	res.json({ success: true });
});

/**
 * GET /api/admin/inventory/stats
 * Get inventory statistics
 */
router.get('/inventory/stats', adminOnly, async (req, res) => {
	try {
		const stats = await getStats();
		res.json({ success: true, stats });
	} catch (err) {
		console.error('[admin] Error getting inventory stats:', err);
		res.status(500).json({
			success: false,
			message: 'Failed to get inventory stats',
			error: err.message,
		});
	}
});

/**
 * GET /api/admin/inventory/expiring
 * Get inventory items expiring soon
 */
router.get('/inventory/expiring', adminOnly, async (req, res) => {
	try {
		const days = parseInt(req.query.days) || 7;
		const items = await getExpiringSoon(days);

		res.json({
			success: true,
			items,
			count: items.length,
			daysThreshold: days,
		});
	} catch (err) {
		console.error('[admin] Error getting expiring inventory:', err);
		res.status(500).json({
			success: false,
			message: 'Failed to get expiring inventory',
			error: err.message,
		});
	}
});

/**
 * GET /api/admin/inventory/:productId
 * Get inventory for a specific product
 */
router.get('/inventory/:productId', adminOnly, async (req, res) => {
	try {
		const { productId } = req.params;
		const { showSold, showExpired, limit, offset } = req.query;

		const items = await listInventory(productId, {
			showSold: showSold === 'true',
			showExpired: showExpired === 'true',
			limit: parseInt(limit) || 100,
			offset: parseInt(offset) || 0,
		});

		res.json({ success: true, items, count: items.length });
	} catch (err) {
		console.error('[admin] Error getting inventory:', err);
		res.status(500).json({
			success: false,
			message: 'Failed to get inventory',
			error: err.message,
		});
	}
});

/**
 * POST /api/admin/inventory
 * Add a single inventory item
 */
router.post('/inventory', adminOnly, async (req, res) => {
	try {
		const { productId, secretData, notes, accountExpiresAt, costPrice, source } = req.body;

		// Validate required fields
		if (!productId || !secretData) {
			return res.status(400).json({
				success: false,
				message: 'Product ID and secret data are required',
			});
		}

		// Create inventory item
		const item = await createInventoryItem({
			productId,
			secretData,
			notes: notes || null,
			accountExpiresAt: accountExpiresAt || null,
			costPrice: parseFloat(costPrice) || 0,
			source: source || 'admin_manual',
		});

		// Sync product stock
		await syncProductStock(productId);

		res.status(201).json({
			success: true,
			message: 'Inventory item added successfully',
			item,
		});
	} catch (err) {
		console.error('[admin] Error adding inventory:', err);
		res.status(500).json({
			success: false,
			message: 'Failed to add inventory',
			error: err.message,
		});
	}
});

/**
 * POST /api/admin/inventory/bulk
 * Bulk add inventory items
 */
router.post('/inventory/bulk', adminOnly, async (req, res) => {
	try {
		const { productId, items, itemsText } = req.body;

		if (!productId) {
			return res.status(400).json({
				success: false,
				message: 'Product ID is required',
			});
		}

		let itemsArray = items;

		// If itemsText is provided, parse it
		if (itemsText && typeof itemsText === 'string') {
			const parsedItems = parseBulkInventoryText(itemsText);
			itemsArray = parsedItems.map((text) => ({ secretData: text }));
		}

		if (!Array.isArray(itemsArray) || itemsArray.length === 0) {
			return res.status(400).json({
				success: false,
				message: 'Items array is required and must not be empty',
			});
		}

		const result = await importInventoryItems(productId, itemsArray);

		// Sync product stock
		await syncProductStock(productId);

		res.status(201).json({
			success: true,
			message: `Successfully added ${result.count} inventory items`,
			...result,
		});
	} catch (err) {
		console.error('[admin] Error bulk adding inventory:', err);
		res.status(500).json({
			success: false,
			message: 'Failed to bulk add inventory',
			error: err.message,
		});
	}
});

/**
 * DELETE /api/admin/inventory/:itemId
 * Delete an inventory item (only if not sold)
 */
router.delete('/inventory/:itemId', adminOnly, async (req, res) => {
	try {
		const { itemId } = req.params;

		const deletedItem = await removeInventoryItem(itemId);

		// Sync product stock
		await syncProductStock(deletedItem.product_id);

		res.json({
			success: true,
			message: 'Inventory item deleted successfully',
			item: deletedItem,
		});
	} catch (err) {
		console.error('[admin] Error deleting inventory:', err);
		res.status(500).json({
			success: false,
			message: err.message || 'Failed to delete inventory',
			error: err.message,
		});
	}
});

/**
 * POST /api/admin/inventory/sync-stock
 * Manually sync all product stocks
 */
router.post('/inventory/sync-stock', adminOnly, async (req, res) => {
	try {
		const products = await syncAllProductStocks();

		res.json({
			success: true,
			message: `Synced stock for ${products.length} products`,
			products,
		});
	} catch (err) {
		console.error('[admin] Error syncing stock:', err);
		res.status(500).json({
			success: false,
			message: 'Failed to sync stock',
			error: err.message,
		});
	}
});
// Admin Management Routes
router.get('/admins', requirePermission('admins.view'), listAdminsController);
router.post('/admins', requirePermission('admins.create'), createAdminController);
router.put('/admins/:id/role', requirePermission('admins.edit'), updateAdminRoleController);

// Role & Permission Routes
router.get('/roles', requirePermission('admins.view'), listRolesController);
router.get('/permissions', requirePermission('admins.view'), listPermissionsController);

// Settings Routes (replace existing)
router.get('/settings', requirePermission('settings.view'), getAllSettingsController);
router.put('/settings', requirePermission('settings.edit'), updateSettingsController);

// Note: Product routes are defined above with adminOnly middleware
// If you want to use permission-based middleware instead, replace adminOnly with requirePermission

export default router;
