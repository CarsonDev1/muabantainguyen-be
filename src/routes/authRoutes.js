'use strict';

import express from 'express';
const router = express.Router();

import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  register,
  login,
  logout,
  refresh,
  me,
  updateProfile,
  changePassword,
} from '../controllers/authController.js';

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refresh);

router.get('/me', authMiddleware, me);
router.put('/me', authMiddleware, updateProfile);
router.post('/change-password', authMiddleware, changePassword);

export default router;

