'use strict';

import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { listResourcesController } from '../controllers/resourceController.js';

const router = express.Router();

router.get('/', authMiddleware, listResourcesController);

export default router;

