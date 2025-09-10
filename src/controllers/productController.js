'use strict';

import { listCatalog, getProductDetail, listAllCategories } from '../services/productService.js';

async function listProductsController(req, res) {
  try {
    const { q, categoryId, minPrice, maxPrice, inStock, page, pageSize } = req.query;
    const result = await listCatalog({
      q: q || undefined,
      categoryId: categoryId || undefined,
      minPrice: minPrice != null ? Number(minPrice) : undefined,
      maxPrice: maxPrice != null ? Number(maxPrice) : undefined,
      inStock: inStock === 'true' ? true : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return res.json({ message: 'Products retrieved successfully', ...result });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list products', error: err.message });
  }
}

async function getProductController(req, res) {
  try {
    const { slug } = req.params;
    const product = await getProductDetail(slug);
    return res.json({ message: 'Product retrieved successfully', product });
  } catch (err) {
    const code = err.message.includes('not found') ? 404 : 500;
    return res.status(code).json({ message: 'Failed to get product', error: err.message });
  }
}

async function listCategoriesController(req, res) {
  try {
    const categories = await listAllCategories();
    return res.json({ message: 'Categories retrieved successfully', categories });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list categories', error: err.message });
  }
}

export { listProductsController, getProductController, listCategoriesController };

