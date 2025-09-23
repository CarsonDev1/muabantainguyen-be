'use strict';

import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';
import { webhookAuthMiddleware } from '../middleware/webhookAuthMiddleware.js';
import {
  getWalletController,
  createDepositController,
  checkDepositController,
  getDepositsController,
  getTransactionsController,
  payWithWalletController,
  walletWebhookController,
  adminAdjustWalletController,
  adminGetWalletController,
  adminRefundController
} from '../controllers/walletController.js';

const router = express.Router();

// User wallet routes
router.get('/', authMiddleware, getWalletController);
router.post('/deposit', authMiddleware, createDepositController);
router.get('/deposit/:id', authMiddleware, checkDepositController);
router.get('/deposits', authMiddleware, getDepositsController);
router.get('/transactions', authMiddleware, getTransactionsController);
router.post('/pay', authMiddleware, payWithWalletController);

// Webhook route (with API key auth)
router.post('/webhook', express.json({ type: '*/*' }), webhookAuthMiddleware, walletWebhookController);

// Admin wallet routes
router.post('/admin/adjust', adminOnly, adminAdjustWalletController);
router.get('/admin/:userId', adminOnly, adminGetWalletController);
router.post('/admin/refund', adminOnly, adminRefundController);

export default router;