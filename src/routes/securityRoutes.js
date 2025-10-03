'use strict';

import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { enableTotpController, disableTotpController, verifyTotpController } from '../controllers/securityController.js';

const router = express.Router();

router.post('/2fa/enable', authMiddleware, enableTotpController);
router.post('/2fa/disable', authMiddleware, disableTotpController);
router.post('/2fa/verify', authMiddleware, verifyTotpController);

export default router;

