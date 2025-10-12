'use strict';

import { getOrCreateCart, getCartItems, clearCart } from '../models/cartModel.js';
import { createOrder, listOrders, getOrderDetail } from '../models/orderModel.js';

async function checkout(userId, { paymentMethod }) {
  const cartId = await getOrCreateCart(userId);
  const items = await getCartItems(cartId);
  if (!items.length) throw new Error('Cart is empty');
  const orderItems = items.map((it) => ({ productId: it.product_id, price: it.price, quantity: it.quantity }));
  const { orderId, total } = await createOrder({ userId, items: orderItems, paymentMethod });
  await clearCart(cartId);
  return { orderId, total };
}

async function listUserOrders(userId, { page, pageSize }) {
  const orders = await listOrders(userId, { page, pageSize });
  return { items: orders };
}

async function getUserOrder(userId, orderId) {
  const order = await getOrderDetail(userId, orderId);
  if (!order) throw new Error('Order not found');
  return order;
}

export { checkout, listUserOrders, getUserOrder };

