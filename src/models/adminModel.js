'use strict';

import { pool } from '../setup/db.js';

// Users
async function listUsers({ page = 1, pageSize = 20 }) {
  const offset = (page - 1) * pageSize;
  const { rows } = await pool.query(
    `SELECT id, email, phone, name, role, is_blocked, created_at
     FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  );
  return rows;
}

async function setUserBlocked(userId, blocked) {
  await pool.query(`UPDATE users SET is_blocked = $2 WHERE id = $1`, [userId, blocked]);
}

async function getUserOrders(userId) {
  const { rows } = await pool.query(
    `SELECT id, status, total_amount, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

// Products
async function createProduct({ name, slug, description, price, stock, imageUrl, categoryId }) {
  const { rows } = await pool.query(
    `INSERT INTO products (name, slug, description, price, stock, image_url, category_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [name, slug, description || null, price, stock || 0, imageUrl || null, categoryId || null]
  );
  return rows[0].id;
}

async function updateProduct(id, fields) {
  const updates = [];
  const params = [id];
  let idx = 2;
  for (const [key, value] of Object.entries(fields)) {
    const col = key === 'imageUrl' ? 'image_url' : key;
    updates.push(`${col} = $${idx}`);
    params.push(value);
    idx++;
  }
  if (!updates.length) return;
  await pool.query(`UPDATE products SET ${updates.join(', ')} WHERE id = $1`, params);
}

async function deleteProduct(id) {
  await pool.query(`DELETE FROM products WHERE id = $1`, [id]);
}

// Vouchers
async function createVoucher(data) {
  const { rows } = await pool.query(
    `INSERT INTO vouchers (code, description, discount_percent, discount_amount, max_uses, valid_from, valid_to, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [data.code, data.description || null, data.discount_percent || null, data.discount_amount || null, data.max_uses || null, data.valid_from || null, data.valid_to || null, data.is_active ?? true]
  );
  return rows[0].id;
}

async function listVouchers() {
  const { rows } = await pool.query(`SELECT id, code, description, discount_percent, discount_amount, max_uses, used_count, valid_from, valid_to, is_active FROM vouchers ORDER BY created_at DESC`);
  return rows;
}

async function updateVoucher(id, fields) {
  const updates = [];
  const params = [id];
  let idx = 2;
  for (const [key, value] of Object.entries(fields)) {
    updates.push(`${key} = $${idx}`);
    params.push(value);
    idx++;
  }
  if (!updates.length) return;
  await pool.query(`UPDATE vouchers SET ${updates.join(', ')} WHERE id = $1`, params);
}

async function deleteVoucher(id) {
  await pool.query(`DELETE FROM vouchers WHERE id = $1`, [id]);
}

export { listUsers, setUserBlocked, getUserOrders, createProduct, updateProduct, deleteProduct, createVoucher, listVouchers, updateVoucher, deleteVoucher };

