'use strict';

import { listDeliveries } from '../models/inventoryModel.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

async function listResourcesController(req, res) {
  try {
    const { page, pageSize } = req.query;
    const items = await listDeliveries(req.user.id, { page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined });
    return res.json({ message: 'Resources retrieved successfully', items });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch resources', error: err.message });
  }
}

export { listResourcesController };

