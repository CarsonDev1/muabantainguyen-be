'use strict';

import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { listResourcesController } from '../controllers/resourceController.js';
import { getPublicSettingsController } from '../controllers/siteSettingsController.js';

const router = express.Router();

router.get('/', authMiddleware, listResourcesController);
router.get('/settings', getPublicSettingsController);


export default router;

