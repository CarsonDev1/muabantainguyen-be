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
  getCategoryBySlugController
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
  listPermissionsController
} from '../controllers/adminManagementController.js';

import {
  getAllSettingsController,
  updateSettingsController
} from '../controllers/siteSettingsController.js';

import { requirePermission } from '../middleware/permissionMiddleware.js';

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
  const { rows } = await pool.query(`INSERT INTO faqs (question, answer, is_active) VALUES ($1, $2, COALESCE($3, TRUE)) RETURNING id`, [question, answer, is_active]);
  res.status(201).json({ id: rows[0].id });
});
router.put('/faqs/:id', adminOnly, async (req, res) => {
  await pool.query(`UPDATE faqs SET question = COALESCE($2, question), answer = COALESCE($3, answer), is_active = COALESCE($4, is_active) WHERE id = $1`, [req.params.id, req.body.question || null, req.body.answer || null, req.body.is_active]);
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
    await pool.query(`INSERT INTO site_settings (key, value) VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`, [key, String(value)]);
  }
  res.json({ success: true });
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

