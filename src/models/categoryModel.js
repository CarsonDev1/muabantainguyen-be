'use strict';

import { pool } from '../setup/db.js';

async function listCategories() {
  const { rows } = await pool.query(`SELECT id, name, slug, parent_id, image, created_at FROM categories ORDER BY name ASC`);
  return rows;
}

async function getCategoryBySlug(slug) {
  const { rows } = await pool.query(
    `SELECT id, name, slug, parent_id, image, created_at, updated_at 
     FROM categories WHERE slug = $1 LIMIT 1`,
    [slug]
  );
  return rows[0] || null;
}

async function getCategoryById(id) {
  const { rows } = await pool.query(
    `SELECT id, name, slug, parent_id, image, created_at, updated_at 
     FROM categories WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function createCategory({ name, slug, parentId, image, description, seoTitle, seoDescription }) {
  const { rows } = await pool.query(
    `INSERT INTO categories (name, slug, parent_id, image) 
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, slug, parentId || null, image || null]
  );
  return rows[0].id;
}

async function updateCategory(id, { name, slug, parentId, image, description, seoTitle, seoDescription }) {
  await pool.query(
    `UPDATE categories 
     SET name = COALESCE($2, name), 
         slug = COALESCE($3, slug), 
         parent_id = $4,
         image = COALESCE($5, image),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [id, name || null, slug || null, parentId || null, image || null]
  );
}

async function deleteCategory(id) {
  await pool.query(`DELETE FROM categories WHERE id = $1`, [id]);
}

async function getCategoryTree() {
  const { rows } = await pool.query(
    `SELECT id, name, slug, parent_id, image, created_at, updated_at
     FROM categories 
     ORDER BY name ASC`
  );

  const byId = new Map(rows.map((r) => [r.id, { ...r, children: [] }]));
  const roots = [];

  for (const c of byId.values()) {
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id).children.push(c);
    } else {
      roots.push(c);
    }
  }

  return roots;
}

async function getProductsByCategory(categoryId, page = 1, limit = 12) {
  const offset = (page - 1) * limit;

  // Get total count
  const countQuery = await pool.query(
    `SELECT COUNT(*) as total 
     FROM products p 
     WHERE p.category_id = $1 AND p.is_active = TRUE`,
    [categoryId]
  );

  const total = parseInt(countQuery.rows[0].total);
  const pages = Math.ceil(total / limit);

  // Get products
  const { rows: products } = await pool.query(
    `SELECT p.id, p.name, p.slug, p.description, p.price, p.stock, p.image_url, p.is_active,
            p.created_at, p.updated_at,
            c.name as category_name, c.slug as category_slug, c.image as category_image
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.category_id = $1 AND p.is_active = TRUE
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [categoryId, limit, offset]
  );

  return {
    data: products,
    pagination: {
      page,
      limit,
      total,
      pages
    }
  };
}

export {
  listCategories,
  getCategoryBySlug,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryTree,
  getProductsByCategory
};

