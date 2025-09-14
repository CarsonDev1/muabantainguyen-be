'use strict';

import {
  enhancedCheckout,
  getEnhancedOrderDetail,
  refundOrder,
  getUserOrderStats
} from '../services/enhancedOrderService.js';
import { listUserOrders } from '../services/orderService.js';

// POST /api/orders/checkout - Enhanced checkout với ví
async function enhancedCheckoutController(req, res) {
  try {
    const { paymentMethod = 'sepay', useWallet = false } = req.body;

    const result = await enhancedCheckout(req.user.id, {
      paymentMethod,
      useWallet
    });

    return res.status(201).json({
      success: true,
      message: useWallet ? 'Order created and paid with wallet' : 'Order created successfully',
      ...result
    });
  } catch (error) {
    const statusCode = error.message.includes('empty') ||
      error.message.includes('Insufficient') ? 400 : 500;

    return res.status(statusCode).json({
      success: false,
      message: 'Checkout failed',
      error: error.message
    });
  }
}

// GET /api/orders/:id - Enhanced order detail
async function getEnhancedOrderController(req, res) {
  try {
    const { id } = req.params;
    const order = await getEnhancedOrderDetail(req.user.id, id);

    return res.json({
      success: true,
      message: 'Order retrieved successfully',
      order
    });
  } catch (error) {
    const statusCode = error.message.includes('not found') ? 404 : 500;

    return res.status(statusCode).json({
      success: false,
      message: 'Failed to get order',
      error: error.message
    });
  }
}

// GET /api/orders/stats - Thống kê đơn hàng user
async function getOrderStatsController(req, res) {
  try {
    const stats = await getUserOrderStats(req.user.id);

    return res.json({
      success: true,
      message: 'Order statistics retrieved successfully',
      stats
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get order statistics',
      error: error.message
    });
  }
}

// Admin Controllers

// POST /api/admin/orders/:id/refund - Admin hoàn tiền đơn hàng
async function adminRefundOrderController(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Refund reason is required'
      });
    }

    const result = await refundOrder(id, {
      reason,
      adminId: req.user.id
    });

    return res.json({
      success: true,
      message: 'Order refunded successfully',
      ...result
    });
  } catch (error) {
    const statusCode = error.message.includes('not found') ||
      error.message.includes('already refunded') ||
      error.message.includes('Can only refund') ? 400 : 500;

    return res.status(statusCode).json({
      success: false,
      message: 'Failed to refund order',
      error: error.message
    });
  }
}

export {
  enhancedCheckoutController,
  getEnhancedOrderController,
  getOrderStatsController,
  adminRefundOrderController
};