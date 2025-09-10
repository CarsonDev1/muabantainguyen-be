'use strict';

import express from 'express';
import { pool } from '../setup/db.js';
import { getCategoryTree } from '../models/categoryModel.js';

const router = express.Router();

router.get('/faqs', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, question, answer FROM faqs WHERE is_active = TRUE ORDER BY created_at DESC`);
    res.json({ message: 'FAQs retrieved successfully', faqs: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load FAQs', error: err.message });
  }
});

router.get('/announcements', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, title, content FROM announcements WHERE is_active = TRUE ORDER BY created_at DESC`);
    res.json({ message: 'Announcements retrieved successfully', announcements: rows });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load announcements', error: err.message });
  }
});

export default router;
router.get('/categories/tree', async (req, res) => {
  try {
    const tree = await getCategoryTree();
    res.json({ message: 'Category tree retrieved successfully', tree });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load categories', error: err.message });
  }
});

