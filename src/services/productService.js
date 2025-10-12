'use strict';

import { listProducts, countProducts, getProductBySlug } from '../models/productModel.js';
import { listCategories } from '../models/categoryModel.js';

async function listCatalog({ q, categoryId, minPrice, maxPrice, inStock, page = 1, pageSize = 20 }) {
  const limit = pageSize;
  const offset = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    listProducts({ q, categoryId, minPrice, maxPrice, inStock, limit, offset }),
    countProducts({ q, categoryId, minPrice, maxPrice, inStock }),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

async function getProductDetail(slug) {
  const product = await getProductBySlug(slug);
  if (!product) throw new Error('Product not found');
  return product;
}

async function listAllCategories() {
  return listCategories();
}

export { listCatalog, getProductDetail, listAllCategories };

