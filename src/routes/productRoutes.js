'use strict';

import express from 'express';
import { listProductsController, getProductController, listCategoriesController } from '../controllers/productController.js';

const router = express.Router();

router.get('/categories', listCategoriesController);
router.get('/', listProductsController);
router.get('/:slug', getProductController);

export default router;

