'use strict';

import { checkout, listUserOrders, getUserOrder } from '../services/orderService.js';

async function checkoutController(req, res) {
  try {
    const result = await checkout(req.user.id, req.body);
    return res.status(201).json({ message: 'Order created successfully', ...result });
  } catch (err) {
    const code = err.message.includes('empty') ? 400 : 500;
    return res.status(code).json({ message: 'Checkout failed', error: err.message });
  }
}

async function listOrdersController(req, res) {
  try {
    const { page, pageSize } = req.query;
    const data = await listUserOrders(req.user.id, { page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined });
    return res.json({ message: 'Orders retrieved successfully', ...data });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list orders', error: err.message });
  }
}

async function getOrderController(req, res) {
  try {
    const { id } = req.params;
    const data = await getUserOrder(req.user.id, id);
    return res.json({ message: 'Order retrieved successfully', order: data });
  } catch (err) {
    const code = err.message.includes('not found') ? 404 : 500;
    return res.status(code).json({ message: 'Failed to get order', error: err.message });
  }
}

export { checkoutController, listOrdersController, getOrderController };

