'use strict';

import { pool } from '../setup/db.js';

async function createOrder({ userId, items, paymentMethod }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const total = items.reduce((sum, it) => sum + Number(it.price) * it.quantity, 0);
    const { rows } = await client.query(
      `INSERT INTO orders (user_id, status, total_amount, payment_method)
       VALUES ($1, 'pending', $2, $3)
       RETURNING id`,
      [userId, total, paymentMethod || null]
    );
    const orderId = rows[0].id;
    for (const it of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, name, price, quantity)
         SELECT $1, p.id, p.name, $2, $3 FROM products p WHERE p.id = $4`,
        [orderId, it.price, it.quantity, it.productId]
      );
      await client.query(`UPDATE products SET stock = stock - $2 WHERE id = $1 AND stock >= $2`, [it.productId, it.quantity]);
    }
    await client.query('COMMIT');
    return { orderId, total };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function listOrders(userId, { page = 1, pageSize = 20 }) {
  const offset = (page - 1) * pageSize;
  const { rows } = await pool.query(
    `SELECT id, status, total_amount, payment_method, created_at
     FROM orders WHERE user_id = $1
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [userId, pageSize, offset]
  );
  return rows;
}

async function getOrderDetail(userId, orderId) {
  const { rows } = await pool.query(`SELECT id, status, total_amount, payment_method, created_at FROM orders WHERE id = $1 AND user_id = $2`, [orderId, userId]);
  const order = rows[0];
  if (!order) return null;
  const items = await pool.query(
    `SELECT oi.product_id, oi.name, oi.price, oi.quantity
     FROM order_items oi WHERE oi.order_id = $1 ORDER BY oi.created_at ASC`,
    [orderId]
  );
  return { ...order, items: items.rows };
}

export { createOrder, listOrders, getOrderDetail };

