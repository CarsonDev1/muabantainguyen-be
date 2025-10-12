'use strict';

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getUserDeliveries } from '../models/deliveryModel.js';

const router = express.Router();

/**
 * GET /api/resources
 * Get user's purchased resources (deliveries)
 */
router.get('/', authenticateToken, async (req, res) => {
	try {
		const userId = req.user.id;
		const items = await getUserDeliveries(userId);

		res.json({
			success: true,
			message: 'Resources retrieved successfully',
			items,
			count: items.length,
		});
	} catch (err) {
		console.error('[resources] Error:', err);
		res.status(500).json({
			success: false,
			message: 'Failed to get resources',
			error: err.message,
		});
	}
});

export default router;
