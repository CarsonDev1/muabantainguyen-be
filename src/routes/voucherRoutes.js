'use strict';

import express from 'express';
import { applyVoucherController } from '../controllers/voucherController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/apply', authMiddleware, applyVoucherController);

export default router;

