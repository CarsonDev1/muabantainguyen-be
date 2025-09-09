'use strict';

import { pool } from '../setup/db.js';

async function listCategories() {
  const { rows } = await pool.query(`SELECT id, name, slug, parent_id, created_at FROM categories ORDER BY name ASC`);
  return rows;
}

async function getCategoryBySlug(slug) {
  const { rows } = await pool.query(`SELECT id, name, slug FROM categories WHERE slug = $1 LIMIT 1`, [slug]);
  return rows[0] || null;
}

export { listCategories, getCategoryBySlug };

async function createCategory({ name, slug, parentId }) {
  const { rows } = await pool.query(
    `INSERT INTO categories (name, slug, parent_id) VALUES ($1, $2, $3) RETURNING id`,
    [name, slug, parentId || null]
  );
  return rows[0].id;
}

async function updateCategory(id, { name, slug, parentId }) {
  await pool.query(
    `UPDATE categories SET name = COALESCE($2, name), slug = COALESCE($3, slug), parent_id = $4 WHERE id = $1`,
    [id, name || null, slug || null, parentId || null]
  );
}

async function deleteCategory(id) {
  await pool.query(`DELETE FROM categories WHERE id = $1`, [id]);
}

async function getCategoryTree() {
  const { rows } = await pool.query(`SELECT id, name, slug, parent_id FROM categories ORDER BY name ASC`);
  const byId = new Map(rows.map((r) => [r.id, { ...r, children: [] }]));
  const roots = [];
  for (const c of byId.values()) {
    if (c.parent_id && byId.has(c.parent_id)) byId.get(c.parent_id).children.push(c);
    else roots.push(c);
  }
  return roots;
}

export { createCategory, updateCategory, deleteCategory, getCategoryTree };

