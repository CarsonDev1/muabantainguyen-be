'use strict';

import { pool } from '../setup/db.js';

async function listProducts({ q, categoryId, minPrice, maxPrice, inStock, limit = 20, offset = 0 }) {
  const conditions = ['is_active = TRUE'];
  const params = [];
  let idx = 1;
  if (q) {
    conditions.push(`(LOWER(name) LIKE $${idx} OR LOWER(description) LIKE $${idx})`);
    params.push(`%${q.toLowerCase()}%`);
    idx++;
  }
  if (categoryId) {
    conditions.push(`category_id = $${idx}`);
    params.push(categoryId);
    idx++;
  }
  if (minPrice != null) {
    conditions.push(`price >= $${idx}`);
    params.push(minPrice);
    idx++;
  }
  if (maxPrice != null) {
    conditions.push(`price <= $${idx}`);
    params.push(maxPrice);
    idx++;
  }
  if (inStock === true) conditions.push(`stock > 0`);

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT id, name, slug, price, stock, image_url, category_id, description
     FROM products
     ${where}
     ORDER BY created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );
  return rows;
}

async function countProducts(filters) {
  const conditions = ['is_active = TRUE'];
  const params = [];
  let idx = 1;
  if (filters.q) {
    conditions.push(`(LOWER(name) LIKE $${idx} OR LOWER(description) LIKE $${idx})`);
    params.push(`%${filters.q.toLowerCase()}%`);
    idx++;
  }
  if (filters.categoryId) {
    conditions.push(`category_id = $${idx}`);
    params.push(filters.categoryId);
    idx++;
  }
  if (filters.minPrice != null) {
    conditions.push(`price >= $${idx}`);
    params.push(filters.minPrice);
    idx++;
  }
  if (filters.maxPrice != null) {
    conditions.push(`price <= $${idx}`);
    params.push(filters.maxPrice);
    idx++;
  }
  if (filters.inStock === true) conditions.push(`stock > 0`);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM products ${where}`, params);
  return rows[0]?.count || 0;
}

async function getProductBySlug(slug) {
  const { rows } = await pool.query(
    `SELECT id, name, slug, description, price, stock, image_url, category_id
     FROM products
     WHERE slug = $1 AND is_active = TRUE
     LIMIT 1`,
    [slug]
  );
  return rows[0] || null;
}

export { listProducts, countProducts, getProductBySlug };

