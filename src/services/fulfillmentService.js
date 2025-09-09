'use strict';

import { allocateInventoryForOrder } from '../models/inventoryModel.js';

async function fulfillOrder(orderId) {
  await allocateInventoryForOrder(orderId);
}

export { fulfillOrder };

