'use strict';

import { pool } from '../setup/db.js';

async function getOrCreateCart(userId) {
  const { rows } = await pool.query(`SELECT id FROM carts WHERE user_id = $1 LIMIT 1`, [userId]);
  if (rows[0]) return rows[0].id;
  const inserted = await pool.query(`INSERT INTO carts (user_id) VALUES ($1) RETURNING id`, [userId]);
  return inserted.rows[0].id;
}

async function getCartItems(cartId) {
  const { rows } = await pool.query(
    `SELECT ci.id, ci.product_id, p.name, ci.price, ci.quantity, p.image_url, p.slug
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = $1
     ORDER BY ci.created_at DESC`,
    [cartId]
  );
  return rows;
}

async function addOrUpdateItem(cartId, productId, price, quantity) {
  const { rows } = await pool.query(
    `INSERT INTO cart_items (cart_id, product_id, price, quantity)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (cart_id, product_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, price = EXCLUDED.price
     RETURNING id`,
    [cartId, productId, price, quantity]
  );
  return rows[0].id;
}

async function updateItemQuantity(cartId, productId, quantity) {
  await pool.query(`UPDATE cart_items SET quantity = $3 WHERE cart_id = $1 AND product_id = $2`, [cartId, productId, quantity]);
}

async function removeItem(cartId, productId) {
  await pool.query(`DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2`, [cartId, productId]);
}

async function clearCart(cartId) {
  await pool.query(`DELETE FROM cart_items WHERE cart_id = $1`, [cartId]);
}

export { getOrCreateCart, getCartItems, addOrUpdateItem, updateItemQuantity, removeItem, clearCart };

