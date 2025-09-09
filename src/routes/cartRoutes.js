'use strict';

import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { getCartController, addToCartController, updateCartItemController, removeFromCartController, clearCartController } from '../controllers/cartController.js';

const router = express.Router();

router.get('/', authMiddleware, getCartController);
router.post('/add', authMiddleware, addToCartController);
router.put('/update', authMiddleware, updateCartItemController);
router.post('/remove', authMiddleware, removeFromCartController);
router.post('/clear', authMiddleware, clearCartController);

export default router;

