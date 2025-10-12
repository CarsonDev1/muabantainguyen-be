'use strict';

import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { startPaymentController, checkoutAndCreatePaymentController, sepayWebhookController } from '../controllers/paymentController.js';

const router = express.Router();

// Start a payment for an existing order
router.post('/start', authMiddleware, startPaymentController);

// Checkout current cart and create payment
router.post('/checkout', authMiddleware, checkoutAndCreatePaymentController);

// Sepay webhook (no auth)
router.post('/webhook/sepay', express.json({ type: '*/*' }), sepayWebhookController);

export default router;

