'use strict';

import { getCart, addToCart, updateCartItem, removeFromCart, clearUserCart } from '../services/cartService.js';

async function getCartController(req, res) {
  try {
    const data = await getCart(req.user.id);
    return res.json({ message: 'Cart retrieved successfully', ...data });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get cart', error: err.message });
  }
}

async function addToCartController(req, res) {
  try {
    const data = await addToCart(req.user.id, req.body);
    return res.json({ message: 'Item added to cart successfully', ...data });
  } catch (err) {
    const code = err.message.includes('not found') ? 404 : err.message.includes('Missing') ? 400 : err.message.includes('stock') ? 400 : 500;
    return res.status(code).json({ message: 'Failed to add to cart', error: err.message });
  }
}

async function updateCartItemController(req, res) {
  try {
    const data = await updateCartItem(req.user.id, req.body);
    return res.json({ message: 'Cart item updated successfully', ...data });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update cart item', error: err.message });
  }
}

async function removeFromCartController(req, res) {
  try {
    const data = await removeFromCart(req.user.id, req.body);
    return res.json({ message: 'Item removed from cart successfully', ...data });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to remove from cart', error: err.message });
  }
}

async function clearCartController(req, res) {
  try {
    const data = await clearUserCart(req.user.id);
    return res.json({ message: 'Cart cleared successfully', ...data });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to clear cart', error: err.message });
  }
}

export { getCartController, addToCartController, updateCartItemController, removeFromCartController, clearCartController };

