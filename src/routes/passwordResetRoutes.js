'use strict';

import express from 'express';
const router = express.Router();
import { requestPasswordReset, resetPassword } from '../controllers/passwordResetController.js';

router.post('/forgot', requestPasswordReset);
router.post('/reset', resetPassword);

export default router;

