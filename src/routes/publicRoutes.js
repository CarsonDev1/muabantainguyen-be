'use strict';

import express from 'express';
import { pool } from '../setup/db.js';
import { getCategoryTree } from '../models/categoryModel.js';

const router = express.Router();

router.get('/faqs', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, question, answer FROM faqs WHERE is_active = TRUE ORDER BY created_at DESC`);
    res.json({ message: 'FAQs retrieved successfully', faqs: rows });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/announcements', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, title, content, image, created_at FROM announcements WHERE is_active = TRUE ORDER BY created_at DESC`);
    res.json({ message: 'Announcements retrieved successfully', announcements: rows });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Categories
router.get('/categories/tree', async (req, res) => {
  try {
    const tree = await getCategoryTree();
    res.json({ message: 'Category tree retrieved successfully', tree });
  } catch (error) {
    console.error('Error fetching category tree:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/categories/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { rows } = await pool.query(
      `SELECT c.*, 
              parent.name as parent_name,
              parent.slug as parent_slug,
              COUNT(p.id) as product_count
       FROM categories c
       LEFT JOIN categories parent ON c.parent_id = parent.id
       LEFT JOIN products p ON c.id = p.category_id
       WHERE c.slug = $1
       GROUP BY c.id, parent.name, parent.slug`,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const category = rows[0];

    // Get children categories
    const { rows: children } = await pool.query(
      `SELECT * FROM categories WHERE parent_id = $1 ORDER BY name`,
      [category.id]
    );

    category.children = children;

    res.json({ category });
  } catch (error) {
    console.error('Error fetching category by slug:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT c.*, 
              parent.name as parent_name,
              parent.slug as parent_slug,
              COUNT(p.id) as product_count
       FROM categories c
       LEFT JOIN categories parent ON c.parent_id = parent.id
       LEFT JOIN products p ON c.id = p.category_id
       WHERE c.id = $1
       GROUP BY c.id, parent.name, parent.slug`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const category = rows[0];

    // Get children categories
    const { rows: children } = await pool.query(
      `SELECT * FROM categories WHERE parent_id = $1 ORDER BY name`,
      [id]
    );

    category.children = children;

    res.json({ category });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Products by category
router.get('/categories/:id/products', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, sort = 'created_at', order = 'desc' } = req.query;

    const offset = (page - 1) * limit;

    // Get products with category info
    const { rows } = await pool.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.category_id = $1 AND p.is_active = TRUE
       ORDER BY p.${sort} ${order}
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    // Get total count
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) as total FROM products WHERE category_id = $1 AND is_active = TRUE`,
      [id]
    );

    const total = parseInt(countRows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      products: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching products by category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/categories/slug/:slug/products', async (req, res) => {
  try {
    const { slug } = req.params;
    const { page = 1, limit = 20, sort = 'created_at', order = 'desc' } = req.query;

    const offset = (page - 1) * limit;

    // First get category by slug
    const { rows: categoryRows } = await pool.query(
      `SELECT id FROM categories WHERE slug = $1`,
      [slug]
    );

    if (categoryRows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const categoryId = categoryRows[0].id;

    // Get products with category info
    const { rows } = await pool.query(
      `SELECT p.*, c.name as category_name, c.slug as category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.category_id = $1 AND p.is_active = TRUE
       ORDER BY p.${sort} ${order}
       LIMIT $2 OFFSET $3`,
      [categoryId, limit, offset]
    );

    // Get total count
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) as total FROM products WHERE category_id = $1 AND is_active = TRUE`,
      [categoryId]
    );

    const total = parseInt(countRows[0].total);
    const totalPages = Math.ceil(total / limit);

    res.json({
      products: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching products by category slug:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

