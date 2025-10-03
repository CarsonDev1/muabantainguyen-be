'use strict';

import { getOrCreateCart, getCartItems, addOrUpdateItem, updateItemQuantity, removeItem, clearCart } from '../models/cartModel.js';
import { pool } from '../setup/db.js';

async function getCart(userId) {
  const cartId = await getOrCreateCart(userId);
  const items = await getCartItems(cartId);
  const total = items.reduce((sum, it) => sum + Number(it.price) * it.quantity, 0);
  return { cartId, items, total };
}

async function addToCart(userId, { productId, quantity }) {
  if (!productId || !quantity) throw new Error('Missing fields');
  const { rows } = await pool.query(`SELECT id, price, stock FROM products WHERE id = $1 AND is_active = TRUE`, [productId]);
  const product = rows[0];
  if (!product) throw new Error('Product not found');
  if (quantity > product.stock) throw new Error('Insufficient stock');
  const cartId = await getOrCreateCart(userId);
  await addOrUpdateItem(cartId, productId, product.price, quantity);
  return getCart(userId);
}

async function updateCartItem(userId, { productId, quantity }) {
  const cartId = await getOrCreateCart(userId);
  await updateItemQuantity(cartId, productId, quantity);
  return getCart(userId);
}

async function removeFromCart(userId, { productId }) {
  const cartId = await getOrCreateCart(userId);
  await removeItem(cartId, productId);
  return getCart(userId);
}

async function clearUserCart(userId) {
  const cartId = await getOrCreateCart(userId);
  await clearCart(cartId);
  return getCart(userId);
}

export { getCart, addToCart, updateCartItem, removeFromCart, clearUserCart };

