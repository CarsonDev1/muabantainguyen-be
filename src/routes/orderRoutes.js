'use strict';

import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';
import {
  checkoutController,
  listOrdersController,
  getOrderController
} from '../controllers/orderController.js';
import {
  enhancedCheckoutController,
  getEnhancedOrderController,
  getOrderStatsController,
  adminRefundOrderController
} from '../controllers/enhancedOrderController.js';

const router = express.Router();

// Enhanced checkout với wallet support
router.post('/checkout', authMiddleware, enhancedCheckoutController);

// User order routes
router.get('/', authMiddleware, listOrdersController);
router.get('/stats', authMiddleware, getOrderStatsController);
router.get('/:id', authMiddleware, getEnhancedOrderController);

// Admin order routes
router.post('/:id/refund', adminOnly, adminRefundOrderController);

export default router;