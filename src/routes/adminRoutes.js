'use strict';

import express from 'express';
import { adminOnly } from '../middleware/adminMiddleware.js';
import { pool } from '../setup/db.js';
import { createCategoryController, updateCategoryController, deleteCategoryController, getCategoryTreeController } from '../controllers/adminCategoryController.js';
import {
  listUsersController,
  setBlockController,
  userOrdersController,
  createProductController,
  updateProductController,
  deleteProductController,
  createVoucherController,
  listVouchersController,
  updateVoucherController,
  deleteVoucherController,
} from '../controllers/adminController.js';

const router = express.Router();

// Users
router.get('/users', adminOnly, listUsersController);
router.put('/users/:id/block', adminOnly, setBlockController);
router.get('/users/:id/orders', adminOnly, userOrdersController);

// Products
router.post('/products', adminOnly, createProductController);
router.put('/products/:id', adminOnly, updateProductController);
router.delete('/products/:id', adminOnly, deleteProductController);

// Categories CRUD + tree
router.post('/categories', adminOnly, createCategoryController);
router.put('/categories/:id', adminOnly, updateCategoryController);
router.delete('/categories/:id', adminOnly, deleteCategoryController);
router.get('/categories/tree', adminOnly, getCategoryTreeController);

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
router.post('/announcements', adminOnly, async (req, res) => {
  const { title, content, is_active } = req.body;
  const { rows } = await pool.query(`INSERT INTO announcements (title, content, is_active) VALUES ($1, $2, COALESCE($3, TRUE)) RETURNING id`, [title, content, is_active]);
  res.status(201).json({ id: rows[0].id });
});
router.put('/announcements/:id', adminOnly, async (req, res) => {
  await pool.query(`UPDATE announcements SET title = COALESCE($2, title), content = COALESCE($3, content), is_active = COALESCE($4, is_active) WHERE id = $1`, [req.params.id, req.body.title || null, req.body.content || null, req.body.is_active]);
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

export default router;

