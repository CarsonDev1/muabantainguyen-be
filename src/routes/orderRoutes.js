'use strict';

import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { checkoutController, listOrdersController, getOrderController } from '../controllers/orderController.js';

const router = express.Router();

router.post('/checkout', authMiddleware, checkoutController);
router.get('/', authMiddleware, listOrdersController);
router.get('/:id', authMiddleware, getOrderController);

export default router;

