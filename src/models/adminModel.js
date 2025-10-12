'use strict';

import { pool } from '../setup/db.js';

// Users
async function listUsers({ page = 1, pageSize = 20, search = '', role = '', isBlocked = '', sortBy = 'created_at', sortOrder = 'DESC' }) {
  const offset = (page - 1) * pageSize;

  // Build WHERE conditions
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  // Search condition (name, email, phone)
  if (search) {
    conditions.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR phone ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Role filter
  if (role) {
    conditions.push(`role = $${paramIndex}`);
    params.push(role);
    paramIndex++;
  }

  // Blocked status filter
  if (isBlocked !== '') {
    conditions.push(`is_blocked = $${paramIndex}`);
    params.push(isBlocked === 'true');
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count for pagination
  const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
  const countResult = await pool.query(countQuery, params);
  const total = parseInt(countResult.rows[0].total);

  // Get users with pagination
  const usersQuery = `
    SELECT id, email, phone, name, role, is_blocked, created_at, updated_at
    FROM users 
    ${whereClause}
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(pageSize, offset);
  const { rows } = await pool.query(usersQuery, params);

  return {
    users: rows,
    pagination: {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page * pageSize < total,
      hasPrev: page > 1
    }
  };
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
async function createProduct({ name, slug, description, price, stock, imageUrl, categoryId, category_id }) {
  // Use categoryId or category_id, whichever is provided
  const category = categoryId || category_id;

  const { rows } = await pool.query(
    `INSERT INTO products (name, slug, description, price, stock, image_url, category_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [name, slug, description || null, price, stock || 0, imageUrl || null, category || null]
  );
  return rows[0].id;
}

async function getProductById(id) {
  const { rows } = await pool.query(
    `SELECT p.*, c.name as category_name, c.slug as category_slug
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function updateProduct(id, fields) {
  const updates = [];
  const params = [id];
  let idx = 2;

  for (const [key, value] of Object.entries(fields)) {
    let col = key;

    // Handle field name mappings
    if (key === 'imageUrl') {
      col = 'image_url';
    } else if (key === 'categoryId' || key === 'category_id') {
      col = 'category_id';
    }

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

export { listUsers, setUserBlocked, getUserOrders, createProduct, updateProduct, deleteProduct, createVoucher, listVouchers, updateVoucher, deleteVoucher, getProductById };

